import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { exclude, load, transform } from "../src/plugin";
import { normalizePath } from "../src/util";
import type { GleamProject } from "../src/project";

describe("plugin.ts", () => {
  const tmpDir = normalizePath(resolve("./tests/tmp_plugin"));

  const fakeProject: GleamProject = {
    bin: "gleam",
    cfg: {
      name: "sample_pkg",
      version: "0.1.0",
      target: "javascript",
    },
    log: () => {},
    dir: {
      cwd: tmpDir,
      src: `${tmpDir}/src`,
      out: `${tmpDir}/build/dev/javascript`,
    },
    build: {
      noPrintProgress: true,
      warningsAsErrors: false,
    },
  };

  beforeEach(() => {
    mkdirSync(`${tmpDir}/src`, { recursive: true });
    mkdirSync(`${tmpDir}/build/dev/javascript/sample_pkg`, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should configure server.watch.ignored and build.watch.exclude with exclude()", () => {
    const config: any = {};
    exclude(config);

    expect(config.server?.watch?.ignored).toContain("**/build/dev/javascript/**");
    expect(config.server?.watch?.ignored).toContain("**/build/packages/**");
  });

  it("should preserve existing ignored watchers in exclude()", () => {
    const config: any = {
      server: {
        watch: {
          ignored: ["**/node_modules/**"],
        },
      },
    };
    exclude(config);

    expect(config.server.watch.ignored).toContain("**/node_modules/**");
    expect(config.server.watch.ignored).toContain("**/build/dev/javascript/**");
  });

  it("should load compiled mjs content for gleam files via load()", () => {
    const gleamFile = `${tmpDir}/src/app.gleam`;
    const mjsFile = `${tmpDir}/build/dev/javascript/sample_pkg/app.mjs`;

    writeFileSync(gleamFile, 'pub fn main() { "hello" }');
    writeFileSync(mjsFile, 'export function main() { return "hello"; }');

    const result = load(fakeProject, gleamFile);
    expect(result).toBeDefined();
    expect(result?.code).toBe('export function main() { return "hello"; }');
    expect(result?.map).toBeNull();
  });

  it("should return undefined in load() if file is not a gleam file", () => {
    const result = load(fakeProject, `${tmpDir}/src/app.ts`);
    expect(result).toBeUndefined();
  });

  it("should transform gleam file when fallback transform() is called", () => {
    const gleamFile = `${tmpDir}/src/app.gleam`;
    const mjsFile = `${tmpDir}/build/dev/javascript/sample_pkg/app.mjs`;

    const gleamCode = 'pub fn main() { "hello" }';
    writeFileSync(gleamFile, gleamCode);
    writeFileSync(mjsFile, 'export function main() { return "hello"; }');

    const result = transform(fakeProject, gleamFile, gleamCode);
    expect(result).toBeDefined();
    expect(result?.code).toBe('export function main() { return "hello"; }');
    expect(result?.map).toBeDefined();
  });
});
