import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  getPluginOpts,
  isGleam,
  replaceId,
  getCompiledMjsPath,
  type GleamProject,
} from "../src/project";
import { normalizePath } from "../src/util";

describe("project.ts", () => {
  it("should initialize default options when empty", () => {
    const opts = getPluginOpts(undefined);
    expect(opts.bin).toBe("gleam");
    expect(opts.log.level).toBe("none");
    expect(opts.log.time).toBe(false);
    expect(opts.build.noPrintProgress).toBe(true);
    expect(opts.build.warningsAsErrors).toBe(false);
  });

  it("should respect custom options", () => {
    const opts = getPluginOpts({
      bin: "/custom/gleam",
      cwd: "/custom/cwd",
      log: { level: "info", time: true },
      warningsAsErrors: true,
      noPrintProgress: false,
    });
    expect(opts.bin).toBe("/custom/gleam");
    expect(opts.cwd).toBe("/custom/cwd");
    expect(opts.log.level).toBe("info");
    expect(opts.log.time).toBe(true);
    expect(opts.build.warningsAsErrors).toBe(true);
    expect(opts.build.noPrintProgress).toBe(false);
  });

  it("should identify gleam files with isGleam", () => {
    expect(isGleam("main.gleam")).toBe(true);
    expect(isGleam("src/components/button.gleam")).toBe(true);
    expect(isGleam("C:\\path\\to\\app.gleam")).toBe(true);
    expect(isGleam("main.mjs")).toBe(false);
    expect(isGleam("gleam.toml")).toBe(false);
  });

  it("should replace file extension using replaceId", () => {
    expect(replaceId("app.gleam")).toBe("app.mjs");
    expect(replaceId("src/app.gleam", ".ts")).toBe("src/app.ts");
  });

  it("should compute compiled .mjs path in O(1) using getCompiledMjsPath", () => {
    const fakeProject: GleamProject = {
      bin: "gleam",
      cfg: {
        name: "my_spa",
        version: "1.0.0",
        target: "javascript",
      },
      log: () => { },
      dir: {
        cwd: normalizePath(resolve(".")),
        src: normalizePath(resolve(".", "src")),
        out: normalizePath(resolve(".", "build/dev/javascript")),
      },
      build: {
        noPrintProgress: true,
        warningsAsErrors: false,
      },
    };

    const gleamFile = `${fakeProject.dir.src}/pages/home.gleam`;
    const mjsPath = getCompiledMjsPath(fakeProject, gleamFile);

    expect(mjsPath).toBe(`${fakeProject.dir.out}/my_spa/pages/home.mjs`);
  });

  it("should return undefined for getCompiledMjsPath if cfg is not loaded yet", () => {
    const fakeProject: GleamProject = {
      bin: "gleam",
      cfg: undefined,
      log: () => { },
      dir: {
        cwd: "/app",
        src: "/app/src",
        out: "/app/build/dev/javascript",
      },
      build: { noPrintProgress: true, warningsAsErrors: false },
    };

    expect(getCompiledMjsPath(fakeProject, "/app/src/main.gleam")).toBeUndefined();
  });
});
