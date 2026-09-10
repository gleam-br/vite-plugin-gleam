import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { resolveId, resolveHex, normalize } from "../src/plugin";
import { normalizePath } from "../src/util";
import type { GleamProject } from "../src/project";

describe("resolveId and paths", () => {
  const baseDir = normalizePath(resolve("./tests/fixture_app"));

  const fakeProject: GleamProject = {
    bin: "gleam",
    cfg: {
      name: "awesome_app",
      version: "0.1.0",
      target: "javascript",
    },
    log: () => {},
    dir: {
      cwd: baseDir,
      src: `${baseDir}/src`,
      out: `${baseDir}/build/dev/javascript`,
    },
    build: {
      noPrintProgress: true,
      warningsAsErrors: false,
    },
  };

  it("should normalize Windows paths with normalizePath", () => {
    expect(normalizePath("foo\\bar\\baz")).toBe("foo/bar/baz");
    expect(normalizePath("C:\\workspace\\app\\src\\main.gleam")).toBe(
      "C:/workspace/app/src/main.gleam",
    );
  });

  it("should resolve hex: packages correctly", () => {
    const hexId = resolveHex(fakeProject, "hex:lustre/lustre.mjs");
    expect(hexId).toBe(`${baseDir}/build/dev/javascript/lustre/lustre.mjs`);
  });

  it("should resolve hex: with .gleam extension replacement", () => {
    const hexId = resolveHex(fakeProject, "hex:lustre/ui.gleam");
    expect(hexId).toBe(`${baseDir}/build/dev/javascript/lustre/ui.mjs`);
  });

  it("should normalize gleam source files to build path", () => {
    const normalized = normalize(
      fakeProject,
      `${baseDir}/src/sub/module.gleam`,
      "./other.mjs",
    );
    expect(normalized).toBe("awesome_app/sub/module.mjs");
  });

  it("should resolve relative imports from gleam modules", () => {
    const id = resolveId(
      fakeProject,
      "./components/button.mjs",
      `${baseDir}/src/pages/home.gleam`,
    );
    expect(id).toBe(
      `${baseDir}/build/dev/javascript/awesome_app/pages/components/button.mjs`,
    );
  });

  it("should return undefined if importer is empty", () => {
    const id = resolveId(fakeProject, "./foo.gleam", undefined);
    expect(id).toBeUndefined();
  });
});
