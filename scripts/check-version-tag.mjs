#!/usr/bin/env node
// Fails when a release tag doesn't match package.json's version (hackathon standard: tag = "v" + version).
// The tag comes from the first argument, else GITHUB_REF_NAME (a tag push in CI), else the tag on HEAD.
// With no tag on HEAD there is nothing to check, so it passes (normal commits and pre-push runs).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const headTag = () => {
  try {
    return execSync("git describe --exact-match --tags HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};
const tag = process.argv[2] || (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : "") || headTag();

if (!tag) {
  console.log(`check-version-tag: no tag on HEAD; package.json is v${version}.`);
  process.exit(0);
}
if (tag !== `v${version}`) {
  console.error(`check-version-tag: tag ${tag} doesn't match package.json version v${version}.`);
  process.exit(1);
}
console.log(`check-version-tag: ${tag} matches package.json.`);
