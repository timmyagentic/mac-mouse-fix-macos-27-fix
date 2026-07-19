import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  PROJECT,
  installationPaths,
  loadReleaseManifest,
  parseRuntimeStatus,
  renderLaunchAgent,
  validateArchiveEntries,
  validateArchiveSizeListing,
  validateExtractedTree,
  xmlEscape,
} from "../lib/installer.js";

const exec = promisify(execFile);

test("release manifest is pinned to the npm package and signing policy", async () => {
  const manifest = await loadReleaseManifest();
  assert.equal(manifest.packageName, "mmf27-dock-swipe-fix");
  assert.equal(manifest.installerVersion, "0.2.0");
  assert.equal(manifest.releaseTag, "v0.2.0");
  assert.equal(manifest.bundleIdentifier, PROJECT.bundleIdentifier);
  assert.equal(manifest.signingTeamIdentifier, PROJECT.signingTeamIdentifier);
  assert.deepEqual(manifest.architectures.sort(), ["arm64", "x86_64"]);
});

test("archive validation limits expanded size and entry count", () => {
  const valid = "---------                     -------\n   200520                     18 files\n";
  assert.deepEqual(validateArchiveSizeListing(valid, 18), {
    entryCount: 18,
    uncompressedBytes: 200_520,
  });
  assert.throws(() => validateArchiveSizeListing(valid, 17), /count mismatch/i);
  assert.throws(
    () => validateArchiveSizeListing("  40000000  18 files\n", 18),
    /expands to more/i,
  );
});

test("extracted release validation rejects symbolic links", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mmf27-tree-test-"));
  try {
    await fs.mkdir(path.join(root, "safe"));
    await fs.writeFile(path.join(root, "safe", "payload"), "safe");
    assert.deepEqual(await validateExtractedTree(root), {
      entryCount: 2,
      totalBytes: 4,
    });
    await fs.symlink("payload", path.join(root, "safe", "link"));
    await assert.rejects(validateExtractedTree(root), /symbolic link/i);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("runtime status cannot override installer-owned verification fields", () => {
  assert.deepEqual(
    parseRuntimeStatus(
      "runtime=active\nself_test=pass\ncode_signature=valid\ninstalled=no\n",
    ),
    { runtime: "active", self_test: "pass" },
  );
});

test("archive validation permits the app and metadata but rejects traversal", () => {
  const valid = [
    `${PROJECT.appName}/`,
    `${PROJECT.appName}/Contents/Info.plist`,
    `${PROJECT.appName}/Contents/MacOS/${PROJECT.executableName}`,
    "__MACOSX/metadata",
  ].join("\n");
  assert.equal(validateArchiveEntries(valid).length, 4);
  assert.throws(
    () => validateArchiveEntries(`${valid}\n../outside`),
    /Path traversal/,
  );
  assert.throws(
    () => validateArchiveEntries(`${valid}\nother/file`),
    /Unexpected top-level/,
  );
  assert.throws(
    () =>
      validateArchiveEntries(
        `${valid}\n${PROJECT.appName}/Contents/../../unexpected`,
      ),
    /Non-canonical path/,
  );
});

test("archive validation requires the signed app payload", () => {
  assert.throws(
    () => validateArchiveEntries(`${PROJECT.appName}/Contents/Info.plist`),
    /missing.*MMF27DockSwipeFix/i,
  );
});

test("launch agent escapes paths and contains the exact installed executable", () => {
  const paths = installationPaths("/Users/A&B");
  const plist = renderLaunchAgent(paths);
  assert.match(plist, /\/Users\/A&amp;B\/Applications/);
  assert.match(plist, new RegExp(PROJECT.executableName));
  assert.equal(xmlEscape(`<&>"'`), "&lt;&amp;&gt;&quot;&apos;");
});

test("CLI exposes help and package version", async () => {
  const helpResult = await exec(process.execPath, ["bin/mmf27-fix.js", "--help"]);
  assert.match(helpResult.stdout, /npx --yes mmf27-dock-swipe-fix@latest install/);
  assert.match(helpResult.stdout, /never uses sudo/i);
  const versionResult = await exec(process.execPath, ["bin/mmf27-fix.js", "--version"]);
  assert.equal(versionResult.stdout.trim(), "0.2.0");
});

test("CLI rejects unsupported status options", async () => {
  await assert.rejects(
    exec(process.execPath, ["bin/mmf27-fix.js", "status", "--unsafe"]),
    (error) => {
      assert.match(error.stderr, /status only accepts --json/);
      return true;
    },
  );
});
