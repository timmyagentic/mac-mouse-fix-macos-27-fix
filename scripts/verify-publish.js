#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [packageContents, manifestContents] = await Promise.all([
  readFile(path.join(projectRoot, "package.json"), "utf8"),
  readFile(path.join(projectRoot, "release-manifest.json"), "utf8"),
]);
const packageJSON = JSON.parse(packageContents);
const manifest = JSON.parse(manifestContents);

assert(
  packageJSON.name === "mmf27-dock-swipe-fix",
  `Unexpected package name: ${packageJSON.name}`,
);
assert(
  manifest.appVersion === packageJSON.version,
  `App version ${manifest.appVersion} does not match package ${packageJSON.version}`,
);
assert(
  manifest.releaseTag === `v${packageJSON.version}`,
  `Release tag ${manifest.releaseTag} does not match package ${packageJSON.version}`,
);
if (process.env.GITHUB_REF_NAME) {
  assert(
    process.env.GITHUB_REF_NAME === manifest.releaseTag,
    `Workflow ref ${process.env.GITHUB_REF_NAME} does not match ${manifest.releaseTag}`,
  );
}

const archivePath = path.resolve(projectRoot, manifest.archive);
assert(
  archivePath.startsWith(`${projectRoot}${path.sep}`),
  "Release archive escapes the project root",
);
assert(
  packageJSON.files?.includes(manifest.archive),
  `npm package files do not include ${manifest.archive}`,
);
const archive = await readFile(archivePath);
const actualSHA256 = createHash("sha256").update(archive).digest("hex");
assert(
  actualSHA256 === manifest.sha256,
  `Archive SHA-256 ${actualSHA256} does not match ${manifest.sha256}`,
);

console.log(
  `PASS: ${manifest.releaseTag} package metadata and SHA-256 are consistent.`,
);
