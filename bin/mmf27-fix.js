#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  installRelease,
  installationStatus,
  showInstalledMenu,
  uninstall,
  verifyRelease,
} from "../lib/installer.js";

const packageJSON = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

const help = `MMF27 Dock Swipe Fix ${packageJSON.version}

Usage:
  mmf27-fix install [--dry-run] [--no-open-settings]
  mmf27-fix update [--no-open-settings]
  mmf27-fix status [--json]
  mmf27-fix show
  mmf27-fix verify-release
  mmf27-fix uninstall

Recommended one-line install:
  npx --yes mmf27-dock-swipe-fix@latest install

The installer never uses sudo, disables Gatekeeper, removes quarantine, or
edits the macOS TCC database. Accessibility permission still requires your
approval in System Settings.
`;

function parseInstallOptions(args, { allowDryRun }) {
  const options = {
    dryRun: false,
    openAccessibilitySettings: true,
  };
  for (const argument of args) {
    if (argument === "--dry-run" && allowDryRun) {
      options.dryRun = true;
    } else if (argument === "--no-open-settings") {
      options.openAccessibilitySettings = false;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(help);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    console.log(packageJSON.version);
    return 0;
  }

  if (command === "install") {
    await installRelease(parseInstallOptions(args, { allowDryRun: true }));
    return 0;
  }
  if (command === "update") {
    await installRelease(parseInstallOptions(args, { allowDryRun: false }));
    return 0;
  }
  if (command === "verify-release") {
    if (args.length > 0) throw new Error("verify-release does not accept options.");
    await verifyRelease();
    return 0;
  }
  if (command === "status") {
    if (args.length > 1 || (args.length === 1 && args[0] !== "--json")) {
      throw new Error("status only accepts --json.");
    }
    return installationStatus({ json: args[0] === "--json" });
  }
  if (command === "show") {
    if (args.length > 0) throw new Error("show does not accept options.");
    await showInstalledMenu();
    return 0;
  }
  if (command === "uninstall") {
    if (args.length > 0) throw new Error("uninstall does not accept options.");
    await uninstall();
    return 0;
  }
  throw new Error(`Unknown command: ${command}\n\n${help}`);
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
