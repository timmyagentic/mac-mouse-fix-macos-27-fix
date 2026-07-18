#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <dlfcn.h>
#import <mach/mach_time.h>
#import <math.h>

// Private types are intentionally declared locally so the project builds with
// the public macOS SDK. Mac Mouse Fix already relies on the same HID/SkyLight
// interfaces for its gesture simulation.
@interface MMFHIDEvent : NSObject
- (nullable instancetype)initWithType:(uint32_t)type
                            timestamp:(uint64_t)timestamp
                             senderID:(uint64_t)senderID;
- (void)setIntegerValue:(NSInteger)value forField:(uint32_t)field;
- (NSInteger)integerValueForField:(uint32_t)field;
- (void)setDoubleValue:(double)value forField:(uint32_t)field;
- (double)doubleValueForField:(uint32_t)field;
- (void)appendEvent:(MMFHIDEvent *)event;
@property uint32_t options;
@property (readonly) uint32_t type;
@property (readonly) uint64_t timestamp;
@property (readonly, nullable) NSArray<MMFHIDEvent *> *children;
@end

typedef void (*SLEventSetIOHIDEventFn)(CGEventRef event, CFTypeRef hidEvent);
typedef CFTypeRef _Nullable (*SLEventCopyIOHIDEventFn)(CGEventRef event);

enum {
    MMFHIDEventTypeVelocity = 9,
    MMFHIDEventTypeDockSwipe = 23,
    MMFHIDGestureFlavorDockPrimary = 3,

    MMFHIDEventPhaseBegan = 1 << 0,
    MMFHIDEventPhaseChanged = 1 << 1,
    MMFHIDEventPhaseEnded = 1 << 2,
    MMFHIDEventPhaseCancelled = 1 << 3,
    MMFHIDEventPhaseMask = 0xff,
    MMFHIDEventPhaseShift = 24,
};

#define MMFHIDFieldBase(type) ((uint32_t)(type) << 16)
static const uint32_t MMFHIDFieldVelocityX = MMFHIDFieldBase(MMFHIDEventTypeVelocity) | 0;
static const uint32_t MMFHIDFieldVelocityY = MMFHIDFieldBase(MMFHIDEventTypeVelocity) | 1;
static const uint32_t MMFHIDFieldVelocityZ = MMFHIDFieldBase(MMFHIDEventTypeVelocity) | 2;
static const uint32_t MMFHIDFieldDockSwipeMotion = MMFHIDFieldBase(MMFHIDEventTypeDockSwipe) | 1;
static const uint32_t MMFHIDFieldDockSwipeProgress = MMFHIDFieldBase(MMFHIDEventTypeDockSwipe) | 2;
static const uint32_t MMFHIDFieldDockSwipeFlavor = MMFHIDFieldBase(MMFHIDEventTypeDockSwipe) | 5;

// Private CGEvent fields populated by Mac Mouse Fix 3.0.x/3.1.0 Beta 1.
static const CGEventField MMFCGFieldSubtype = (CGEventField)110;
static const CGEventField MMFCGFieldMotion = (CGEventField)123;
static const CGEventField MMFCGFieldProgress = (CGEventField)124;
static const CGEventField MMFCGFieldVelocityX = (CGEventField)129;
static const CGEventField MMFCGFieldVelocityY = (CGEventField)130;
static const CGEventField MMFCGFieldPhase = (CGEventField)132;
static const CGEventField MMFCGFieldInvertedFromDevice = (CGEventField)136;

static SLEventSetIOHIDEventFn gSetHIDEvent = NULL;
static SLEventCopyIOHIDEventFn gCopyHIDEvent = NULL;
static Class gHIDEventClass = Nil;
static CFMachPortRef gEventTap = NULL;
static CFRunLoopSourceRef gEventTapSource = NULL;
static CFRunLoopRef gEventTapRunLoop = NULL;
static uint64_t gPatchedEventCount = 0;

static BOOL MMFIsMacOS27OrLater(void) {
    return NSProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 27;
}

static BOOL MMFLoadPrivateAPIs(void) {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        void *handle = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight",
                              RTLD_NOW | RTLD_LOCAL);
        if (!handle) {
            NSLog(@"[MMF27Fix] Could not load SkyLight: %s", dlerror());
            return;
        }
        gSetHIDEvent = (SLEventSetIOHIDEventFn)dlsym(handle, "SLEventSetIOHIDEvent");
        gCopyHIDEvent = (SLEventCopyIOHIDEventFn)dlsym(handle, "SLEventCopyIOHIDEvent");
        gHIDEventClass = NSClassFromString(@"HIDEvent");
    });
    return gSetHIDEvent != NULL && gHIDEventClass != Nil;
}

static MMFHIDEvent *MMFCopyExistingHIDEvent(CGEventRef event) {
    if (!gCopyHIDEvent) return nil;
    CFTypeRef copied = gCopyHIDEvent(event);
    if (!copied) return nil;
    return CFBridgingRelease(copied);
}

static double MMFNormalizeLegacyDirection(double value, BOOL inverted) {
    return inverted ? -value : value;
}

static BOOL MMFTimestampsEquivalent(uint64_t actual, uint64_t expected) {
    // The reconstructed HIDEvent implementation can quantize the low timestamp
    // bits under Rosetta. Keep the comparison strict enough to catch replacing
    // the source timestamp with "now" while accepting that sub-microsecond
    // representation detail.
    uint64_t difference = actual > expected ? actual - expected : expected - actual;
    return difference <= 1000;
}

static BOOL MMFAttachDockSwipePayload(CGEventRef event) {
    if (!event || !MMFIsMacOS27OrLater() || !MMFLoadPrivateAPIs()) return NO;

    int64_t subtype = CGEventGetIntegerValueField(event, MMFCGFieldSubtype);
    if (subtype != MMFHIDEventTypeDockSwipe) return NO;

    MMFHIDEvent *existing = MMFCopyExistingHIDEvent(event);
    if (existing.type == MMFHIDEventTypeDockSwipe) return NO;

    NSInteger motion = (NSInteger)llround(CGEventGetDoubleValueField(event, MMFCGFieldMotion));
    if (motion < 1 || motion > 3) {
        NSLog(@"[MMF27Fix] Ignoring dock-swipe with unexpected motion %ld", (long)motion);
        return NO;
    }

    uint32_t phase = (uint32_t)CGEventGetIntegerValueField(event, MMFCGFieldPhase) & MMFHIDEventPhaseMask;
    BOOL inverted = CGEventGetIntegerValueField(event, MMFCGFieldInvertedFromDevice) != 0;
    double progress = MMFNormalizeLegacyDirection(
        CGEventGetDoubleValueField(event, MMFCGFieldProgress), inverted);

    // Mac Mouse Fix pre-flips both legacy progress and exit velocity when the
    // input is inverted. The native macOS 27 HID path applies that direction
    // itself, so both values must be restored to device coordinates. Flipping
    // only progress makes the release velocity point backwards and produces a
    // visible one- or two-frame rebound at the end of a Space transition.
    double velocityX = MMFNormalizeLegacyDirection(
        CGEventGetDoubleValueField(event, MMFCGFieldVelocityX), inverted);
    double velocityY = MMFNormalizeLegacyDirection(
        CGEventGetDoubleValueField(event, MMFCGFieldVelocityY), inverted);

    // Preserve the CGEvent's original timestamp instead of stamping the event
    // after the cross-process event-tap hop. This keeps WindowServer's gesture
    // timing independent from scheduling jitter in the companion process. A
    // value of zero is intentional: it matches Mac Mouse Fix's native macOS 27
    // event builder and lets the system assign timing semantics.
    uint64_t eventTimestamp = CGEventGetTimestamp(event);
    MMFHIDEvent *hidEvent = [[gHIDEventClass alloc] initWithType:MMFHIDEventTypeDockSwipe
                                                      timestamp:eventTimestamp
                                                       senderID:0];
    if (!hidEvent) return NO;

    hidEvent.options = phase << MMFHIDEventPhaseShift;
    [hidEvent setIntegerValue:motion forField:MMFHIDFieldDockSwipeMotion];
    [hidEvent setIntegerValue:MMFHIDGestureFlavorDockPrimary forField:MMFHIDFieldDockSwipeFlavor];
    [hidEvent setDoubleValue:progress forField:MMFHIDFieldDockSwipeProgress];

    if (phase == MMFHIDEventPhaseEnded || phase == MMFHIDEventPhaseCancelled) {
        MMFHIDEvent *velocity = [[gHIDEventClass alloc] initWithType:MMFHIDEventTypeVelocity
                                                          timestamp:eventTimestamp
                                                           senderID:0];
        if (velocity) {
            [velocity setDoubleValue:velocityX forField:MMFHIDFieldVelocityX];
            [velocity setDoubleValue:velocityY forField:MMFHIDFieldVelocityY];
            [velocity setDoubleValue:0.0 forField:MMFHIDFieldVelocityZ];
            [hidEvent appendEvent:velocity];
        }
    }

    gSetHIDEvent(event, (__bridge CFTypeRef)hidEvent);
    gPatchedEventCount += 1;
    if ((phase == MMFHIDEventPhaseEnded || phase == MMFHIDEventPhaseCancelled)
        && getenv("MMF27_VERBOSE_EVENTS") != NULL) {
        fprintf(stderr,
                "[MMF27Fix] patched_event=%llu motion=%ld phase=%u inverted=%d "
                "progress=%.5f velocity=(%.3f,%.3f)\n",
                gPatchedEventCount,
                (long)motion,
                phase,
                inverted,
                progress,
                velocityX,
                velocityY);
    }
    return YES;
}

static BOOL MMFRunSelfTestCase(NSInteger motion,
                               uint32_t phase,
                               double progress,
                               BOOL inverted,
                               double velocityValue,
                               uint64_t eventTimestamp) {
    CGEventRef event = CGEventCreate(NULL);
    CGEventSetType(event, (CGEventType)30);
    CGEventSetTimestamp(event, eventTimestamp);
    CGEventSetIntegerValueField(event, MMFCGFieldSubtype, MMFHIDEventTypeDockSwipe);
    CGEventSetIntegerValueField(event, MMFCGFieldMotion, motion);
    CGEventSetIntegerValueField(event, MMFCGFieldPhase, phase);
    CGEventSetDoubleValueField(event, MMFCGFieldProgress, progress);
    CGEventSetIntegerValueField(event, MMFCGFieldInvertedFromDevice, inverted);
    CGEventSetDoubleValueField(event, MMFCGFieldVelocityX, velocityValue);
    CGEventSetDoubleValueField(event, MMFCGFieldVelocityY, velocityValue);

    BOOL attached = MMFAttachDockSwipePayload(event);
    MMFHIDEvent *hidEvent = MMFCopyExistingHIDEvent(event);
    double expectedProgress = MMFNormalizeLegacyDirection(progress, inverted);
    double expectedVelocity = MMFNormalizeLegacyDirection(velocityValue, inverted);
    BOOL valid = attached
        && hidEvent.type == MMFHIDEventTypeDockSwipe
        && MMFTimestampsEquivalent(hidEvent.timestamp, eventTimestamp)
        && ((hidEvent.options >> MMFHIDEventPhaseShift) & MMFHIDEventPhaseMask) == phase
        && [hidEvent integerValueForField:MMFHIDFieldDockSwipeMotion] == motion
        && [hidEvent integerValueForField:MMFHIDFieldDockSwipeFlavor] == MMFHIDGestureFlavorDockPrimary
        // HID stores these values in fixed-point form, so allow its expected
        // quantization error when reading the payload back.
        && fabs([hidEvent doubleValueForField:MMFHIDFieldDockSwipeProgress] - expectedProgress) < 0.0001;

    BOOL needsVelocity = phase == MMFHIDEventPhaseEnded || phase == MMFHIDEventPhaseCancelled;
    if (needsVelocity) {
        MMFHIDEvent *velocity = hidEvent.children.firstObject;
        valid = valid
            && velocity.type == MMFHIDEventTypeVelocity
            && MMFTimestampsEquivalent(velocity.timestamp, eventTimestamp)
            && fabs([velocity doubleValueForField:MMFHIDFieldVelocityX] - expectedVelocity) < 0.000001
            && fabs([velocity doubleValueForField:MMFHIDFieldVelocityY] - expectedVelocity) < 0.000001;
    } else {
        valid = valid && hidEvent.children.count == 0;
    }

    // A delayed duplicate end-event should reuse its already attached payload.
    BOOL idempotent = !MMFAttachDockSwipePayload(event);
    valid = valid && idempotent;
    if (!valid) {
        fprintf(stderr,
                "self-test case failed: motion=%ld phase=%u type=%u options=%u "
                "actualMotion=%ld flavor=%ld progress=%.6f timestamp=%llu "
                "children=%lu idempotent=%d\n",
                (long)motion,
                phase,
                hidEvent.type,
                hidEvent.options,
                (long)[hidEvent integerValueForField:MMFHIDFieldDockSwipeMotion],
                (long)[hidEvent integerValueForField:MMFHIDFieldDockSwipeFlavor],
                [hidEvent doubleValueForField:MMFHIDFieldDockSwipeProgress],
                hidEvent.timestamp,
                (unsigned long)hidEvent.children.count,
                idempotent);
    }
    CFRelease(event);
    return valid;
}

static BOOL MMFRunSelfTest(NSError **error) {
    if (!MMFIsMacOS27OrLater()) {
        if (error) *error = [NSError errorWithDomain:@"MMF27Fix" code:1
                                            userInfo:@{NSLocalizedDescriptionKey: @"Self-test requires macOS 27 or later."}];
        return NO;
    }
    if (!MMFLoadPrivateAPIs() || !gCopyHIDEvent) {
        if (error) *error = [NSError errorWithDomain:@"MMF27Fix" code:2
                                            userInfo:@{NSLocalizedDescriptionKey: @"Required SkyLight HID APIs are unavailable."}];
        return NO;
    }

    BOOL valid = YES;
    valid = valid && MMFRunSelfTestCase(1, MMFHIDEventPhaseChanged, 0.25, YES, 0.0, 1001);
    valid = valid && MMFRunSelfTestCase(2, MMFHIDEventPhaseBegan, -0.5, NO, 0.0, 1002);
    valid = valid && MMFRunSelfTestCase(3, MMFHIDEventPhaseEnded, 0.75, NO, 42.0, 1003);
    // Regression coverage for the direction-dependent release rebound seen in
    // the screen recording: inverted progress and velocity must both flip.
    valid = valid && MMFRunSelfTestCase(1, MMFHIDEventPhaseCancelled, -0.33, YES, -18.0, 1004);
    valid = valid && MMFRunSelfTestCase(2, MMFHIDEventPhaseEnded, 0.4, YES, 27.0, 1005);

    CGEventRef unrelated = CGEventCreate(NULL);
    CGEventSetType(unrelated, (CGEventType)30);
    CGEventSetIntegerValueField(unrelated, MMFCGFieldSubtype, 8);
    valid = valid && !MMFAttachDockSwipePayload(unrelated);
    CFRelease(unrelated);

    if (!valid && error) {
        *error = [NSError errorWithDomain:@"MMF27Fix" code:3
                                 userInfo:@{NSLocalizedDescriptionKey: @"One or more Dock Swipe HID payload tests failed."}];
    }
    return valid;
}

static CGEventRef MMFEventTapCallback(CGEventTapProxy proxy,
                                      CGEventType type,
                                      CGEventRef event,
                                      void *userInfo) {
    (void)proxy;
    (void)userInfo;
    if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
        if (gEventTap) CGEventTapEnable(gEventTap, true);
        return event;
    }
    MMFAttachDockSwipePayload(event);
    return event;
}

@interface MMFAppDelegate : NSObject <NSApplicationDelegate>
@property NSStatusItem *statusItem;
@property NSMenuItem *statusMenuItem;
@property NSTimer *retryTimer;
@property NSString *runtimeStatusCode;
@property NSThread *eventTapThread;
@property BOOL terminating;
@end

@implementation MMFAppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    (void)notification;
    [self createStatusMenu];

    if (!MMFIsMacOS27OrLater()) {
        [self updateRuntimeStatus:@"inactive_wrong_os" title:@"Inactive — macOS 27 is not installed"];
        return;
    }
    if (!MMFLoadPrivateAPIs()) {
        [self updateRuntimeStatus:@"error_private_api" title:@"Error — required system API unavailable"];
        return;
    }

    [self attemptToStartEventTapAndPrompt:YES];
    self.retryTimer = [NSTimer scheduledTimerWithTimeInterval:2.0
                                                      target:self
                                                    selector:@selector(retryEventTap:)
                                                    userInfo:nil
                                                     repeats:YES];
}

- (void)applicationWillTerminate:(NSNotification *)notification {
    (void)notification;
    self.terminating = YES;
    [self.retryTimer invalidate];
    self.retryTimer = nil;

    // The event tap owns and releases its Core Foundation objects on its
    // dedicated thread. CFRunLoopStop is thread-safe and avoids releasing an
    // event tap while its callback is in flight.
    if (gEventTapRunLoop) CFRunLoopStop(gEventTapRunLoop);
}

- (void)createStatusMenu {
    self.statusItem = [NSStatusBar.systemStatusBar statusItemWithLength:NSSquareStatusItemLength];
    NSImage *image = [NSImage imageWithSystemSymbolName:@"computermouse.fill"
                              accessibilityDescription:@"Mac Mouse Fix macOS 27 Fix"];
    image.template = YES;
    self.statusItem.button.image = image;
    self.statusItem.button.toolTip = @"Mac Mouse Fix macOS 27 Dock Swipe Fix";

    NSMenu *menu = [[NSMenu alloc] init];
    self.statusMenuItem = [[NSMenuItem alloc] initWithTitle:@"Starting…" action:nil keyEquivalent:@""];
    self.statusMenuItem.enabled = NO;
    [menu addItem:self.statusMenuItem];
    [menu addItem:NSMenuItem.separatorItem];
    [menu addItemWithTitle:@"Open Accessibility Settings…"
                    action:@selector(openAccessibilitySettings:)
             keyEquivalent:@""];
    [menu addItemWithTitle:@"Run Self-Test"
                    action:@selector(runSelfTestFromMenu:)
             keyEquivalent:@""];
    [menu addItem:NSMenuItem.separatorItem];
    [menu addItemWithTitle:@"Quit Until Next Login"
                    action:@selector(quit:)
             keyEquivalent:@"q"];
    self.statusItem.menu = menu;
}

- (void)updateRuntimeStatus:(NSString *)code title:(NSString *)title {
    self.statusMenuItem.title = title;
    if ([self.runtimeStatusCode isEqualToString:code]) return;
    self.runtimeStatusCode = code;

    NSString *support = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support/MMF27 Dock Swipe Fix"];
    [NSFileManager.defaultManager createDirectoryAtPath:support
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];
    NSString *statusPath = [support stringByAppendingPathComponent:@"runtime-status.txt"];
    NSString *line = [NSString stringWithFormat:@"%@\n", code];
    [line writeToFile:statusPath atomically:YES encoding:NSUTF8StringEncoding error:nil];
    fprintf(stderr, "[MMF27Fix] runtime_status=%s\n", code.UTF8String);
}

- (void)retryEventTap:(NSTimer *)timer {
    (void)timer;
    if (!self.eventTapThread || self.eventTapThread.finished) {
        self.eventTapThread = nil;
        [self attemptToStartEventTapAndPrompt:NO];
    }
}

- (void)attemptToStartEventTapAndPrompt:(BOOL)prompt {
    if (self.eventTapThread && !self.eventTapThread.finished) return;

    NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @(prompt)};
    if (!AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options)) {
        [self updateRuntimeStatus:@"waiting_accessibility" title:@"Waiting for Accessibility permission"];
        return;
    }

    __weak MMFAppDelegate *weakSelf = self;
    NSThread *thread = [[NSThread alloc] initWithBlock:^{
        @autoreleasepool {
            MMFAppDelegate *strongSelf = weakSelf;
            [strongSelf runEventTapLoop];
        }
    }];
    thread.name = @"MMF27 Dock Swipe Event Tap";
    thread.qualityOfService = NSQualityOfServiceUserInteractive;
    self.eventTapThread = thread;
    [thread start];
}

- (void)runEventTapLoop {
    NSThread *thisThread = NSThread.currentThread;

    CGEventMask mask = (CGEventMask)1ULL << 30;
    CFMachPortRef eventTap = CGEventTapCreate(kCGSessionEventTap,
                                              kCGHeadInsertEventTap,
                                              kCGEventTapOptionDefault,
                                              mask,
                                              MMFEventTapCallback,
                                              NULL);
    if (!eventTap) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.eventTapThread == thisThread) self.eventTapThread = nil;
            if (!self.terminating) {
                [self updateRuntimeStatus:@"waiting_event_tap"
                                    title:@"Waiting for event-monitor permission"];
            }
        });
        return;
    }

    CFRunLoopSourceRef eventTapSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault,
                                                                     eventTap,
                                                                     0);
    if (!eventTapSource) {
        CFRelease(eventTap);
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.eventTapThread == thisThread) self.eventTapThread = nil;
            if (!self.terminating) {
                [self updateRuntimeStatus:@"error_event_tap_source"
                                    title:@"Error — could not create event-tap source"];
            }
        });
        return;
    }

    CFRunLoopRef runLoop = CFRunLoopGetCurrent();
    CFRetain(runLoop);
    gEventTap = eventTap;
    gEventTapSource = eventTapSource;
    gEventTapRunLoop = runLoop;

    CFRunLoopAddSource(runLoop, eventTapSource, kCFRunLoopCommonModes);
    CGEventTapEnable(eventTap, true);
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.terminating) {
            [self updateRuntimeStatus:@"active" title:@"Active — low-latency Dock Swipe repair enabled"];
            NSLog(@"[MMF27Fix] Low-latency event repair is active");
        }
    });

    CFRunLoopRun();

    CGEventTapEnable(eventTap, false);
    CFRunLoopRemoveSource(runLoop, eventTapSource, kCFRunLoopCommonModes);
    gEventTapRunLoop = NULL;
    gEventTapSource = NULL;
    gEventTap = NULL;
    CFRelease(eventTapSource);
    CFRelease(eventTap);
    CFRelease(runLoop);

    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.eventTapThread == thisThread) self.eventTapThread = nil;
        if (!self.terminating) {
            [self updateRuntimeStatus:@"waiting_event_tap"
                                title:@"Restarting event repair…"];
        }
    });
}

- (void)openAccessibilitySettings:(id)sender {
    (void)sender;
    NSURL *url = [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"];
    [NSWorkspace.sharedWorkspace openURL:url];
}

- (void)runSelfTestFromMenu:(id)sender {
    (void)sender;
    NSError *error = nil;
    BOOL passed = MMFRunSelfTest(&error);
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = passed ? @"Self-Test Passed" : @"Self-Test Failed";
    alert.informativeText = passed
        ? [NSString stringWithFormat:@"Dock Swipe HID payload creation works. Patched events this session: %llu.", gPatchedEventCount]
        : (error.localizedDescription ?: @"Unknown error");
    [alert runModal];
}

- (void)quit:(id)sender {
    (void)sender;
    [NSApp terminate:nil];
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc > 1 && strcmp(argv[1], "--self-test") == 0) {
            NSError *error = nil;
            if (MMFRunSelfTest(&error)) {
                printf("PASS: macOS 27 Dock Swipe HID payload round-trip succeeded.\n");
                return 0;
            }
            fprintf(stderr, "FAIL: %s\n", error.localizedDescription.UTF8String ?: "unknown error");
            return 1;
        }
        if (argc > 1 && strcmp(argv[1], "--status") == 0) {
            NSError *error = nil;
            BOOL apiAvailable = MMFLoadPrivateAPIs();
            BOOL trusted = AXIsProcessTrusted();
            BOOL selfTestPassed = MMFRunSelfTest(&error);
            NSString *runtimePath = [NSHomeDirectory() stringByAppendingPathComponent:
                @"Library/Application Support/MMF27 Dock Swipe Fix/runtime-status.txt"];
            NSString *runtime = [NSString stringWithContentsOfFile:runtimePath
                                                          encoding:NSUTF8StringEncoding
                                                             error:nil];
            printf("macOS=%ld\n", (long)NSProcessInfo.processInfo.operatingSystemVersion.majorVersion);
            printf("private_api=%s\n", apiAvailable ? "ok" : "unavailable");
            printf("accessibility=%s\n", trusted ? "granted" : "pending");
            printf("self_test=%s\n", selfTestPassed ? "pass" : "fail");
            printf("runtime=%s", runtime.length ? runtime.UTF8String : "unknown\n");
            if (error) printf("error=%s\n", error.localizedDescription.UTF8String);
            return apiAvailable && trusted && selfTestPassed ? 0 : 2;
        }

        NSApplication *application = NSApplication.sharedApplication;
        application.activationPolicy = NSApplicationActivationPolicyAccessory;
        MMFAppDelegate *delegate = [[MMFAppDelegate alloc] init];
        application.delegate = delegate;
        [application run];
    }
    return 0;
}
