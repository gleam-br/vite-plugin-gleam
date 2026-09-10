import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";
import plugin from "../src/index";
import * as projectModule from "../src/project";
import { normalizePath } from "../src/util";

describe("E2E Vite bundling", () => {
  const tmpDir = normalizePath(resolve("./tests/tmp_e2e"));

  beforeEach(() => {
    mkdirSync(`${tmpDir}/src`, { recursive: true });
    mkdirSync(`${tmpDir}/build/dev/javascript/e2e_app`, { recursive: true });

    writeFileSync(
      `${tmpDir}/gleam.toml`,
      `name = "e2e_app"\nversion = "1.0.0"\ntarget = "javascript"\n`,
    );

    writeFileSync(
      `${tmpDir}/src/main.gleam`,
      `pub fn greet() -> String { "Hello from Gleam!" }`,
    );

    writeFileSync(
      `${tmpDir}/build/dev/javascript/e2e_app/main.mjs`,
      `export function greet() { return "Hello from Gleam!"; }`,
    );

    writeFileSync(
      `${tmpDir}/entry.js`,
      `import { greet } from "./src/main.gleam";\nconsole.log(greet());\n`,
    );
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("should bundle .gleam file into JavaScript using Vite build", async () => {
    // Mock projectBuild to avoid calling external gleam binary in CI/environments without gleam
    vi.spyOn(projectModule, "projectBuild").mockResolvedValue({
      stdout: "",
      stderr: "",
      durationMs: 10,
    });

    const output = await build({
      root: tmpDir,
      logLevel: "silent",
      plugins: [plugin({ cwd: tmpDir })],
      build: {
        write: false,
        lib: {
          entry: `${tmpDir}/entry.js`,
          formats: ["es"],
          fileName: "bundle",
        },
      },
    });

    expect(output).toBeDefined();
    const bundle = Array.isArray(output) ? output[0] : output;
    const chunk = (bundle as any).output?.[0];

    expect(chunk).toBeDefined();
    expect(chunk.code).toContain("Hello from Gleam!");
  });
});
