import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const loader = new URL("../server/environment.ts", import.meta.url).href;
const tsx = new URL("../node_modules/tsx/dist/loader.mjs", import.meta.url).href;

test("server configuration loads .env without overriding launch settings or leaking into tests", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sciai-env-fixture-"));
  const variable = "SCIAI_SYNTHETIC_ENV_TEST";
  fs.writeFileSync(path.join(directory, ".env"), `${variable}=synthetic-from-file\n`);
  const check = (mode: string, inherited?: string) => {
    const env = { ...process.env, NODE_ENV: mode, npm_lifecycle_event: "", [variable]: inherited };
    if (inherited === undefined) delete env[variable];
    return execFileSync(
      process.execPath,
      [
        "--import",
        tsx,
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(loader)}); console.log(JSON.stringify(process.env.${variable} ?? null));`,
      ],
      { cwd: directory, env, encoding: "utf8" }
    ).trim();
  };
  try {
    assert.equal(check("development"), '"synthetic-from-file"');
    assert.equal(check("production"), '"synthetic-from-file"');
    assert.equal(check("development", "explicit-launch-setting"), '"explicit-launch-setting"');
    assert.equal(check("test"), "null");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});