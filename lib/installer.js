import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const maximumArchiveBytes = 100 * 1024 * 1024;
const maximumExtractedBytes = 32 * 1024 * 1024;
const maximumExtractedEntries = 1_024;
const allowedRuntimeStatusKeys = new Set([
  "macOS",
  "private_api",
  "accessibility",
  "self_test",
  "runtime",
  "menu_bar_mode",
  "menu_bar_icon",
]);

export const PROJECT = Object.freeze({
  appName: "MMF27 Dock Swipe Fix.app",
  executableName: "MMF27DockSwipeFix",
  bundleIdentifier: "local.timmy.mmf27-dock-swipe-fix",
  signingTeamIdentifier: "4356B4HF9R",
  launchAgentLabel: "local.timmy.mmf27-dock-swipe-fix",
  minimumMacOSMajor: 27,
});
const developerIDRequirement =
  `identifier "${PROJECT.bundleIdentifier}" ` +
  "and anchor apple generic " +
  "and certificate leaf[field.1.2.840.113635.100.6.1.13] exists " +
  `and certificate leaf[subject.OU] = "${PROJECT.signingTeamIdentifier}"`;

export function installationPaths(homeDirectory = os.homedir()) {
  const supportRoot = path.join(
    homeDirectory,
    "Library",
    "Application Support",
    "MMF27 Dock Swipe Fix",
  );
  return {
    homeDirectory,
    installRoot: path.join(homeDirectory, "Applications"),
    installApp: path.join(homeDirectory, "Applications", PROJECT.appName),
    supportRoot,
    backupsRoot: path.join(supportRoot, "Backups"),
    launchAgent: path.join(
      homeDirectory,
      "Library",
      "LaunchAgents",
      `${PROJECT.launchAgentLabel}.plist`,
    ),
    logPath: path.join(supportRoot, "plugin.log"),
  };
}

export async function loadReleaseManifest() {
  const [manifestContents, packageContents] = await Promise.all([
    fs.readFile(path.join(packageRoot, "release-manifest.json"), "utf8"),
    fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestContents);
  const packageJSON = JSON.parse(packageContents);
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported release manifest schema: ${manifest.schemaVersion}.`);
  }
  if (manifest.releaseTag !== `v${manifest.appVersion}`) {
    throw new Error(`Release tag ${manifest.releaseTag} does not match the app version.`);
  }
  if (
    manifest.bundleIdentifier !== PROJECT.bundleIdentifier ||
    manifest.signingTeamIdentifier !== PROJECT.signingTeamIdentifier
  ) {
    throw new Error("Release manifest identity does not match the installer policy.");
  }
  for (const architecture of ["arm64", "x86_64"]) {
    if (!manifest.architectures?.includes(architecture)) {
      throw new Error(`Release manifest is missing ${architecture}.`);
    }
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.sha256)) {
    throw new Error("Release manifest has an invalid SHA-256 value.");
  }

  const archivePath = path.resolve(packageRoot, manifest.archive);
  if (!archivePath.startsWith(`${packageRoot}${path.sep}`)) {
    throw new Error("Release manifest archive path escapes the npm package.");
  }
  return {
    ...manifest,
    archivePath,
    packageName: packageJSON.name,
    installerVersion: packageJSON.version,
  };
}

export function validateArchiveEntries(entries) {
  const names = String(entries)
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (names.length === 0) throw new Error("Release archive is empty.");

  for (const name of names) {
    if (name.includes("\\") || name.startsWith("/") || name.includes("\0")) {
      throw new Error(`Unsafe path in release archive: ${name}`);
    }
    const normalized = path.posix.normalize(name);
    if (normalized === ".." || normalized.startsWith("../")) {
      throw new Error(`Path traversal in release archive: ${name}`);
    }
    if (normalized !== name) {
      throw new Error(`Non-canonical path in release archive: ${name}`);
    }
    if (
      !normalized.startsWith(`${PROJECT.appName}/`) &&
      !normalized.startsWith("__MACOSX/")
    ) {
      throw new Error(`Unexpected top-level path in release archive: ${name}`);
    }
  }

  const required = [
    `${PROJECT.appName}/Contents/Info.plist`,
    `${PROJECT.appName}/Contents/MacOS/${PROJECT.executableName}`,
  ];
  for (const requiredPath of required) {
    if (!names.includes(requiredPath)) {
      throw new Error(`Release archive is missing ${requiredPath}.`);
    }
  }
  return names;
}

export function validateArchiveSizeListing(contents, expectedEntryCount) {
  const summaries = [...String(contents).matchAll(/^\s*(\d+)\s+(\d+)\s+files?\s*$/gm)];
  if (summaries.length !== 1) {
    throw new Error("Could not determine the release archive's expanded size.");
  }
  const uncompressedBytes = Number(summaries[0][1]);
  const entryCount = Number(summaries[0][2]);
  if (!Number.isSafeInteger(uncompressedBytes) || uncompressedBytes < 0) {
    throw new Error("Release archive reports an invalid expanded size.");
  }
  if (entryCount !== expectedEntryCount || entryCount > maximumExtractedEntries) {
    throw new Error(
      `Release archive entry count mismatch (${entryCount}, expected ${expectedEntryCount}).`,
    );
  }
  if (uncompressedBytes > maximumExtractedBytes) {
    throw new Error(
      `Release archive expands to more than ${maximumExtractedBytes} bytes.`,
    );
  }
  return { entryCount, uncompressedBytes };
}

export async function validateExtractedTree(rootPath) {
  const realRootPath = await fs.realpath(rootPath);
  let entryCount = 0;
  let totalBytes = 0;

  async function visit(directoryPath) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      entryCount += 1;
      if (entryCount > maximumExtractedEntries) {
        throw new Error(
          `Extracted release contains more than ${maximumExtractedEntries} entries.`,
        );
      }

      const entryPath = path.join(directoryPath, entry.name);
      const stat = await fs.lstat(entryPath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Extracted release contains a symbolic link: ${entryPath}.`);
      }
      if (stat.isDirectory()) {
        await visit(entryPath);
        continue;
      }
      if (!stat.isFile()) {
        throw new Error(`Extracted release contains an unsupported file type: ${entryPath}.`);
      }

      totalBytes += stat.size;
      if (totalBytes > maximumExtractedBytes) {
        throw new Error(
          `Extracted release exceeds ${maximumExtractedBytes} bytes.`,
        );
      }
      const realEntryPath = await fs.realpath(entryPath);
      if (!realEntryPath.startsWith(`${realRootPath}${path.sep}`)) {
        throw new Error(`Extracted release escaped the temporary directory: ${entryPath}.`);
      }
    }
  }

  await visit(rootPath);
  return { entryCount, totalBytes };
}

export function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderLaunchAgent(paths) {
  const executable = path.join(
    paths.installApp,
    "Contents",
    "MacOS",
    PROJECT.executableName,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(PROJECT.launchAgentLabel)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(executable)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>StandardOutPath</key>
  <string>${xmlEscape(paths.logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(paths.logPath)}</string>
</dict>
</plist>
`;
}

async function run(command, args, options = {}) {
  const { allowFailure = false, ...execOptions } = options;
  try {
    const result = await execFile(command, args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60_000,
      killSignal: "SIGKILL",
      ...execOptions,
    });
    return { ...result, exitCode: 0 };
  } catch (error) {
    if (allowFailure) {
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || error.message || "",
        exitCode: typeof error.code === "number" ? error.code : 1,
      };
    }
    const detail = String(error.stderr || error.stdout || error.message).trim();
    throw new Error(`${path.basename(command)} failed${detail ? `: ${detail}` : ""}`);
  }
}

async function readPlistValue(plistPath, key) {
  const result = await run("/usr/bin/plutil", [
    "-extract",
    key,
    "raw",
    "-o",
    "-",
    plistPath,
  ]);
  return result.stdout.trim();
}

async function readCodeSignature(appPath) {
  await run("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    `-R=${developerIDRequirement}`,
    appPath,
  ]);
  const result = await run("/usr/bin/codesign", [
    "-dv",
    "--verbose=4",
    appPath,
  ]);
  const output = `${result.stdout}\n${result.stderr}`;
  return {
    identifier: output.match(/^Identifier=(.+)$/m)?.[1]?.trim(),
    teamIdentifier: output.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim(),
  };
}

async function verifyExtractedApp(appPath, manifest) {
  const signature = await readCodeSignature(appPath);
  if (signature.identifier !== PROJECT.bundleIdentifier) {
    throw new Error(
      `Unexpected code-signing identifier: ${signature.identifier || "missing"}.`,
    );
  }
  if (signature.teamIdentifier !== PROJECT.signingTeamIdentifier) {
    throw new Error(
      `Unexpected signing team: ${signature.teamIdentifier || "missing"}.`,
    );
  }

  const infoPlist = path.join(appPath, "Contents", "Info.plist");
  const plistIdentifier = await readPlistValue(infoPlist, "CFBundleIdentifier");
  const appVersion = await readPlistValue(infoPlist, "CFBundleShortVersionString");
  if (plistIdentifier !== PROJECT.bundleIdentifier) {
    throw new Error(`Unexpected app bundle identifier: ${plistIdentifier}.`);
  }
  if (appVersion !== manifest.appVersion) {
    throw new Error(
      `App version ${appVersion} does not match pinned release ${manifest.appVersion}.`,
    );
  }

  const executable = path.join(appPath, "Contents", "MacOS", PROJECT.executableName);
  const architectureResult = await run("/usr/bin/lipo", ["-archs", executable]);
  const architectures = architectureResult.stdout.trim().split(/\s+/);
  for (const requiredArchitecture of manifest.architectures) {
    if (!architectures.includes(requiredArchitecture)) {
      throw new Error(`Release is missing ${requiredArchitecture} support.`);
    }
  }
  await run(executable, ["--self-test"], { timeout: 10_000 });
  return { appVersion, architectures, ...signature };
}

export async function prepareVerifiedRelease(logger = console) {
  const manifest = await loadReleaseManifest();
  const stat = await fs.stat(manifest.archivePath);
  if (!stat.isFile() || stat.size > maximumArchiveBytes) {
    throw new Error(`Bundled release archive has an invalid size: ${stat.size} bytes.`);
  }

  const archiveContents = await fs.readFile(manifest.archivePath);
  const actualChecksum = createHash("sha256").update(archiveContents).digest("hex");
  if (actualChecksum !== manifest.sha256) {
    throw new Error(
      `SHA-256 mismatch: expected ${manifest.sha256}, received ${actualChecksum}.`,
    );
  }
  logger.log(`Verified bundled ${manifest.releaseTag} SHA-256 ${actualChecksum}.`);

  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mmf27-npm-installer-"),
  );
  try {
    const [listing, sizeListing] = await Promise.all([
      run("/usr/bin/unzip", ["-Z1", manifest.archivePath]),
      run("/usr/bin/unzip", ["-l", manifest.archivePath]),
    ]);
    const archiveEntries = validateArchiveEntries(listing.stdout);
    validateArchiveSizeListing(sizeListing.stdout, archiveEntries.length);
    const extractionRoot = path.join(temporaryDirectory, "extracted");
    await fs.mkdir(extractionRoot);
    await run("/usr/bin/ditto", [
      "-x",
      "-k",
      manifest.archivePath,
      extractionRoot,
    ]);
    await validateExtractedTree(extractionRoot);
    const appPath = path.join(extractionRoot, PROJECT.appName);
    const realExtractionRoot = await fs.realpath(extractionRoot);
    const realAppPath = await fs.realpath(appPath);
    if (!realAppPath.startsWith(`${realExtractionRoot}${path.sep}`)) {
      throw new Error("Extracted app escaped the temporary directory.");
    }

    const verification = await verifyExtractedApp(appPath, manifest);
    logger.log(
      `Verified Developer ID team ${verification.teamIdentifier}, universal binary, and HID self-test.`,
    );
    return {
      manifest,
      checksum: actualChecksum,
      appPath,
      temporaryDirectory,
      verification,
    };
  } catch (error) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function assertSupportedInstallationSystem() {
  if (process.platform !== "darwin") {
    throw new Error("This installer only supports macOS.");
  }
  assertNormalUser();
  const versionResult = await run("/usr/bin/sw_vers", ["-productVersion"]);
  const majorVersion = Number.parseInt(versionResult.stdout, 10);
  if (!Number.isInteger(majorVersion) || majorVersion < PROJECT.minimumMacOSMajor) {
    throw new Error(
      `This repair requires macOS ${PROJECT.minimumMacOSMajor} or later (found ${versionResult.stdout.trim()}).`,
    );
  }
  try {
    await fs.access("/Applications/Mac Mouse Fix.app");
  } catch {
    throw new Error("Mac Mouse Fix was not found at /Applications/Mac Mouse Fix.app.");
  }
}

function assertNormalUser() {
  if (process.getuid?.() === 0 || process.env.SUDO_USER) {
    throw new Error("Run this installer as your normal user, without sudo.");
  }
}

async function pathExists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function launchAgentIsLoaded() {
  const domain = `gui/${process.getuid()}`;
  const result = await run(
    "/bin/launchctl",
    ["print", `${domain}/${PROJECT.launchAgentLabel}`],
    { allowFailure: true },
  );
  if (result.exitCode === 0) return true;
  const detail = `${result.stdout}\n${result.stderr}`;
  if (detail.includes("Could not find service")) return false;
  throw new Error(`Unable to inspect LaunchAgent state: ${detail.trim()}`);
}

export function executablePathMatches(actualPath, expectedPath) {
  if (
    typeof actualPath !== "string" ||
    typeof expectedPath !== "string" ||
    actualPath.trim().length === 0 ||
    expectedPath.trim().length === 0
  ) {
    return false;
  }
  return path.resolve(actualPath.trim()) === path.resolve(expectedPath.trim());
}

async function processExecutablePath(pid) {
  const result = await run("/bin/ps", ["-p", pid, "-o", "comm="], {
    allowFailure: true,
  });
  if (result.exitCode === 1) return null;
  if (result.exitCode !== 0) {
    throw new Error(
      `Unable to inspect companion PID ${pid}: ${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
}

async function matchingExecutablePids() {
  const result = await run(
    "/usr/bin/pgrep",
    ["-u", String(process.getuid()), "-x", PROJECT.executableName],
    {
      allowFailure: true,
    },
  );
  if (result.exitCode === 1) return [];
  if (result.exitCode !== 0) {
    throw new Error(`Unable to inspect companion processes: ${result.stderr.trim()}`);
  }
  const candidatePids = result.stdout
    .split(/\s+/)
    .filter((pid) => /^\d+$/.test(pid));
  const expectedExecutable = path.join(
    installationPaths().installApp,
    "Contents",
    "MacOS",
    PROJECT.executableName,
  );
  const inspected = await Promise.all(
    candidatePids.map(async (pid) => ({
      pid,
      executablePath: await processExecutablePath(pid),
    })),
  );
  return inspected
    .filter(({ executablePath }) =>
      executablePathMatches(executablePath, expectedExecutable),
    )
    .map(({ pid }) => pid);
}

async function stopLaunchAgent() {
  const domain = `gui/${process.getuid()}`;
  if (await launchAgentIsLoaded()) {
    await run("/bin/launchctl", [
      "bootout",
      `${domain}/${PROJECT.launchAgentLabel}`,
    ]);
  }

  const pids = await matchingExecutablePids();
  for (const pid of pids) {
    await run("/bin/kill", ["-TERM", pid], { allowFailure: true });
  }
  if (pids.length > 0) await new Promise((resolve) => setTimeout(resolve, 500));
  const remainingPids = await matchingExecutablePids();
  if (remainingPids.length > 0) {
    throw new Error(
      `Companion process did not stop cleanly (PID ${remainingPids.join(", ")}).`,
    );
  }
}

async function currentRuntimeState() {
  const [launchAgentLoaded, executablePids] = await Promise.all([
    launchAgentIsLoaded(),
    matchingExecutablePids(),
  ]);
  return {
    launchAgentLoaded,
    executableRunning: executablePids.length > 0,
  };
}

async function writeLaunchAgent(paths) {
  await fs.mkdir(path.dirname(paths.launchAgent), { recursive: true });
  const temporaryPath = `${paths.launchAgent}.tmp-${process.pid}`;
  try {
    await fs.writeFile(temporaryPath, renderLaunchAgent(paths), { mode: 0o644 });
    await run("/usr/bin/plutil", ["-lint", temporaryPath]);
    await fs.rename(temporaryPath, paths.launchAgent);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function startLaunchAgent(paths) {
  const domain = `gui/${process.getuid()}`;
  await run("/bin/launchctl", ["bootstrap", domain, paths.launchAgent]);
  await run("/bin/launchctl", [
    "kickstart",
    "-k",
    `${domain}/${PROJECT.launchAgentLabel}`,
  ]);
}

export async function installRelease(options = {}) {
  const {
    dryRun = false,
    openAccessibilitySettings = true,
    logger = console,
  } = options;
  await assertSupportedInstallationSystem();
  const paths = installationPaths();
  const manifest = await loadReleaseManifest();

  if (dryRun) {
    const preparedDryRun = await prepareVerifiedRelease(logger);
    try {
      logger.log(`[dry-run] Would install to ${paths.installApp}.`);
      logger.log(`[dry-run] Would register ${paths.launchAgent}.`);
      return { dryRun: true, manifest, verification: preparedDryRun.verification };
    } finally {
      await fs.rm(preparedDryRun.temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  }

  const prepared = await prepareVerifiedRelease(logger);
  let previous = null;
  let backupApp = null;
  let backupAgent = null;
  let appBackedUp = false;
  let launchAgentBackedUp = false;
  let newAppMayExist = false;
  let launchAgentWasWritten = false;
  try {
    previous = {
      appExisted: await pathExists(paths.installApp),
      launchAgentExisted: await pathExists(paths.launchAgent),
      ...(await currentRuntimeState()),
    };
    try {
      await stopLaunchAgent();
      await fs.mkdir(paths.installRoot, { recursive: true });
      await fs.mkdir(paths.backupsRoot, { recursive: true });

      const backupTimestamp = timestamp();
      if (previous.appExisted) {
        backupApp = path.join(
          paths.backupsRoot,
          `${backupTimestamp}-${process.pid}-${PROJECT.appName}.backup`,
        );
        await fs.rename(paths.installApp, backupApp);
        appBackedUp = true;
        logger.log(`Backed up the previous app to ${backupApp}.`);
      }

      if (previous.launchAgentExisted) {
        backupAgent = path.join(
          paths.backupsRoot,
          `${backupTimestamp}-${process.pid}-launch-agent.plist`,
        );
        await fs.copyFile(paths.launchAgent, backupAgent);
        launchAgentBackedUp = true;
      }

      newAppMayExist = true;
      await run("/usr/bin/ditto", [prepared.appPath, paths.installApp]);
      await verifyExtractedApp(paths.installApp, prepared.manifest);
      await writeLaunchAgent(paths);
      launchAgentWasWritten = true;
      await startLaunchAgent(paths);
    } catch (error) {
      const rollbackFailures = [];
      const attemptRollback = async (description, action) => {
        try {
          await action();
        } catch (rollbackError) {
          rollbackFailures.push(`${description}: ${rollbackError.message}`);
        }
      };

      await attemptRollback("stop replacement service", stopLaunchAgent);
      if (newAppMayExist) {
        await attemptRollback("remove partial replacement app", async () => {
          if (await pathExists(paths.installApp)) {
            await fs.rm(paths.installApp, { recursive: true, force: true });
          }
        });
      }
      if (appBackedUp) {
        await attemptRollback("restore previous app", async () => {
          await fs.rename(backupApp, paths.installApp);
        });
      }
      if (launchAgentBackedUp) {
        await attemptRollback("restore previous LaunchAgent", async () => {
          await fs.copyFile(backupAgent, paths.launchAgent);
        });
      } else if (launchAgentWasWritten && !previous.launchAgentExisted) {
        await attemptRollback("remove replacement LaunchAgent", async () => {
          if (await pathExists(paths.launchAgent)) await fs.unlink(paths.launchAgent);
        });
      }

      let previousServiceRestored = false;
      if (
        previous.launchAgentLoaded &&
        previous.launchAgentExisted
      ) {
        await attemptRollback("restart previous LaunchAgent", async () => {
          if (
            !(await pathExists(paths.launchAgent)) ||
            !(await pathExists(paths.installApp))
          ) {
            throw new Error("restored app or LaunchAgent is missing");
          }
          if (!(await launchAgentIsLoaded())) await startLaunchAgent(paths);
          previousServiceRestored = true;
        });
      }
      if (
        !previousServiceRestored &&
        previous.executableRunning &&
        previous.appExisted
      ) {
        await attemptRollback("reopen previous app", async () => {
          if (!(await pathExists(paths.installApp))) {
            throw new Error("restored app is missing");
          }
          await run("/usr/bin/open", [paths.installApp]);
        });
      }

      const rollbackDetail = rollbackFailures.length
        ? ` Rollback also encountered: ${rollbackFailures.join("; ")}`
        : previous.appExisted || previous.launchAgentExisted
          ? " The previous installation was restored."
          : " The partial installation was removed.";
      throw new Error(`${error.message}.${rollbackDetail}`, { cause: error });
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const executable = path.join(
      paths.installApp,
      "Contents",
      "MacOS",
      PROJECT.executableName,
    );
    const status = await run(executable, ["--status"], {
      allowFailure: true,
      timeout: 10_000,
    });
    logger.log(status.stdout.trim());
    if (
      openAccessibilitySettings &&
      !status.stdout.includes("accessibility=granted")
    ) {
      await run(
        "/usr/bin/open",
        ["x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"],
        { allowFailure: true },
      );
    }

    logger.log(`Installed MMF27 Dock Swipe Fix ${prepared.manifest.appVersion}.`);
    logger.log(`Location: ${paths.installApp}`);
    if (!status.stdout.includes("runtime=active")) {
      logger.log(
        "Enable MMF27 Dock Swipe Fix in System Settings > Privacy & Security > Accessibility, then run the status command again.",
      );
    }
    return {
      appVersion: prepared.manifest.appVersion,
      installApp: paths.installApp,
      backupApp,
      status: status.stdout,
    };
  } finally {
    await fs.rm(prepared.temporaryDirectory, { recursive: true, force: true });
  }
}

export async function verifyRelease(logger = console) {
  const prepared = await prepareVerifiedRelease(logger);
  try {
    logger.log(
      `PASS: ${prepared.manifest.releaseTag} is signed, universal, checksum-valid, and self-test clean.`,
    );
    return prepared;
  } finally {
    await fs.rm(prepared.temporaryDirectory, { recursive: true, force: true });
  }
}

function parseKeyValueStatus(contents) {
  return Object.fromEntries(
    String(contents)
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

export function parseRuntimeStatus(contents) {
  return Object.fromEntries(
    Object.entries(parseKeyValueStatus(contents)).filter(([key]) =>
      allowedRuntimeStatusKeys.has(key),
    ),
  );
}

export function serviceStatus(runtimeState) {
  return runtimeState.executableRunning ? "running" : "stopped";
}

export function installationStatusIsHealthy(result, statusExitCode) {
  return (
    statusExitCode === 0 &&
    result.self_test === "pass" &&
    result.runtime === "active" &&
    result.service === "running"
  );
}

function emitInstallationStatus(result, logger, json, stderr = "") {
  if (json) {
    logger.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const [key, value] of Object.entries(result)) {
    logger.log(`${key}=${typeof value === "boolean" ? (value ? "yes" : "no") : value}`);
  }
  if (stderr) logger.error(stderr.trim());
}

export async function installationStatus(options = {}) {
  const { logger = console, json = false } = options;
  assertNormalUser();
  const paths = installationPaths();
  const result = { installed: false };
  if (!(await pathExists(paths.installApp))) {
    emitInstallationStatus(result, logger, json);
    return 2;
  }

  result.installed = true;
  try {
    const signature = await readCodeSignature(paths.installApp);
    result.code_signature =
      signature.identifier === PROJECT.bundleIdentifier &&
      signature.teamIdentifier === PROJECT.signingTeamIdentifier
        ? "valid"
        : "unexpected_identity";
    result.signing_team = signature.teamIdentifier || "missing";
  } catch {
    result.code_signature = "invalid";
  }
  if (result.code_signature !== "valid") {
    emitInstallationStatus(result, logger, json);
    return 2;
  }

  try {
    result.installed_version = await readPlistValue(
      path.join(paths.installApp, "Contents", "Info.plist"),
      "CFBundleShortVersionString",
    );
  } catch {
    result.installed_version = "unreadable";
    emitInstallationStatus(result, logger, json);
    return 2;
  }

  const executable = path.join(
    paths.installApp,
    "Contents",
    "MacOS",
    PROJECT.executableName,
  );
  const status = await run(executable, ["--status"], {
    allowFailure: true,
    timeout: 10_000,
  });
  Object.assign(result, parseRuntimeStatus(status.stdout));
  const runtimeState = await currentRuntimeState();
  result.service = serviceStatus(runtimeState);
  emitInstallationStatus(result, logger, json, status.stderr);
  return installationStatusIsHealthy(result, status.exitCode) ? 0 : 2;
}

export async function showInstalledMenu(logger = console) {
  assertNormalUser();
  const paths = installationPaths();
  if (!(await pathExists(paths.installApp))) {
    throw new Error(
      "MMF27 Dock Swipe Fix is not installed. Run the install command first.",
    );
  }

  const appStat = await fs.lstat(paths.installApp);
  if (!appStat.isDirectory() || appStat.isSymbolicLink()) {
    throw new Error("The installed app path is not a regular app bundle.");
  }

  const signature = await readCodeSignature(paths.installApp);
  if (
    signature.identifier !== PROJECT.bundleIdentifier ||
    signature.teamIdentifier !== PROJECT.signingTeamIdentifier
  ) {
    throw new Error("The installed app does not match the trusted signing identity.");
  }

  const infoPlist = path.join(paths.installApp, "Contents", "Info.plist");
  const plistIdentifier = await readPlistValue(infoPlist, "CFBundleIdentifier");
  if (plistIdentifier !== PROJECT.bundleIdentifier) {
    throw new Error(`Unexpected app bundle identifier: ${plistIdentifier}.`);
  }

  const executable = path.join(
    paths.installApp,
    "Contents",
    "MacOS",
    PROJECT.executableName,
  );
  const executableStat = await fs.lstat(executable);
  if (!executableStat.isFile() || executableStat.isSymbolicLink()) {
    throw new Error("The installed app executable is not a regular file.");
  }

  await run("/usr/bin/open", [paths.installApp]);
  await new Promise((resolve) => setTimeout(resolve, 750));
  const showResult = await run(executable, ["--show-menu"], {
    timeout: 10_000,
  });
  const detail = showResult.stdout.trim();
  logger.log(detail || "Requested the MMF27 Dock Swipe Fix menu bar icon.");
  return { appPath: paths.installApp };
}

export async function uninstall(logger = console) {
  assertNormalUser();
  const paths = installationPaths();
  const previous = await currentRuntimeState();
  const targets = [];
  for (const target of [paths.installApp, paths.launchAgent]) {
    if (await pathExists(target)) targets.push(target);
  }

  if (targets.length === 0) {
    if (previous.launchAgentLoaded || previous.executableRunning) {
      await stopLaunchAgent();
    }
    logger.log("MMF27 Dock Swipe Fix is not installed.");
    return { moved: [] };
  }

  const trashDirectory = path.join(
    paths.homeDirectory,
    ".Trash",
    `MMF27 Dock Swipe Fix Uninstall ${timestamp()}-${process.pid}`,
  );
  await fs.mkdir(trashDirectory, { recursive: true });

  const moved = [];
  try {
    await stopLaunchAgent();
    for (const target of targets) {
      const destination = path.join(trashDirectory, path.basename(target));
      if (await pathExists(destination)) {
        throw new Error(`Trash destination already exists: ${destination}.`);
      }
      await fs.rename(target, destination);
      moved.push({ source: target, destination });
    }
  } catch (error) {
    const rollbackFailures = [];
    for (const item of [...moved].reverse()) {
      try {
        await fs.rename(item.destination, item.source);
      } catch (rollbackError) {
        rollbackFailures.push(`restore ${item.source}: ${rollbackError.message}`);
      }
    }

    let serviceRestored = false;
    if (previous.launchAgentLoaded) {
      try {
        if (
          !(await pathExists(paths.launchAgent)) ||
          !(await pathExists(paths.installApp))
        ) {
          throw new Error("restored app or LaunchAgent is missing");
        }
        if (!(await launchAgentIsLoaded())) await startLaunchAgent(paths);
        serviceRestored = true;
      } catch (rollbackError) {
        rollbackFailures.push(`restart previous LaunchAgent: ${rollbackError.message}`);
      }
    }
    if (
      !serviceRestored &&
      previous.executableRunning
    ) {
      try {
        if (!(await pathExists(paths.installApp))) {
          throw new Error("restored app is missing");
        }
        await run("/usr/bin/open", [paths.installApp]);
      } catch (rollbackError) {
        rollbackFailures.push(`reopen previous app: ${rollbackError.message}`);
      }
    }
    try {
      await fs.rmdir(trashDirectory);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOTEMPTY" && cleanupError.code !== "ENOENT") {
        rollbackFailures.push(`remove empty Trash folder: ${cleanupError.message}`);
      }
    }
    const rollbackDetail = rollbackFailures.length
      ? ` Rollback also encountered: ${rollbackFailures.join("; ")}`
      : " The previous installation was restored.";
    throw new Error(`${error.message}.${rollbackDetail}`, { cause: error });
  }

  logger.log(`Uninstalled. Recoverable files were moved to ${trashDirectory}.`);
  return {
    moved: moved.map((item) => item.destination),
    trashDirectory,
  };
}
