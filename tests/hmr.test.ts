import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import plugin from "../src/index";
import * as projectModule from "../src/project";
import { normalizePath } from "../src/util";

describe("HMR and Error Handling", () => {
  const tmpDir = normalizePath(resolve("./tests/tmp_hmr"));

  beforeEach(() => {
    mkdirSync(`${tmpDir}/src`, { recursive: true });
    mkdirSync(`${tmpDir}/build/dev/javascript/hmr_test`, { recursive: true });
    writeFileSync(
      `${tmpDir}/gleam.toml`,
      `name = "hmr_test"\nversion = "1.0.0"\ntarget = "javascript"\n`,
    );
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("should ignore non-gleam files during handleHotUpdate", async () => {
    const p = plugin({ cwd: tmpDir });
    const ctx: any = {
      file: `${tmpDir}/src/style.css`,
      modules: [],
      server: {
        moduleGraph: {
          invalidateModule: vi.fn(),
          getModuleById: vi.fn(),
        },
        ws: { send: vi.fn() },
      },
    };

    const result = await (p as any).handleHotUpdate(ctx);
    expect(result).toBeUndefined();
  });

  it("should invalidate affected modules on gleam file change", async () => {
    const p = plugin({ cwd: tmpDir });
    // Initialize config in buildStart
    await (p as any).buildStart();

    const gleamFile = `${tmpDir}/src/app.gleam`;
    const mjsFile = `${tmpDir}/build/dev/javascript/hmr_test/app.mjs`;

    const fakeGleamModule = { id: gleamFile, file: gleamFile };
    const fakeMjsModule = { id: mjsFile, file: mjsFile };

    const invalidateModule = vi.fn();
    const getModuleById = vi.fn((id: string) => {
      if (id === mjsFile) return fakeMjsModule;
      return null;
    });

    const ctx: any = {
      file: gleamFile,
      modules: [fakeGleamModule],
      server: {
        moduleGraph: {
          invalidateModule,
          getModuleById,
        },
        ws: { send: vi.fn() },
      },
    };

    // Mock projectBuild to succeed without calling external binary
    vi.spyOn(projectModule, "projectBuild").mockResolvedValue({
      stdout: "",
      stderr: "",
      durationMs: 15,
    });

    const affected = await (p as any).handleHotUpdate(ctx);

    expect(affected).toBeDefined();
    expect(affected).toContain(fakeGleamModule);
    expect(affected).toContain(fakeMjsModule);
    expect(invalidateModule).toHaveBeenCalledWith(fakeGleamModule);
    expect(invalidateModule).toHaveBeenCalledWith(fakeMjsModule);
  });

  it("should report compiler errors to Vite overlay when build fails", async () => {
    const p = plugin({ cwd: tmpDir });
    await (p as any).buildStart();

    const gleamFile = `${tmpDir}/src/broken.gleam`;
    const wsSend = vi.fn();

    const ctx: any = {
      file: gleamFile,
      modules: [{ id: gleamFile }],
      server: {
        moduleGraph: {
          invalidateModule: vi.fn(),
          getModuleById: vi.fn(),
        },
        ws: { send: wsSend },
      },
    };

    // Mock projectBuild failure
    vi.spyOn(projectModule, "projectBuild").mockRejectedValue({
      message: "Compile error in broken.gleam",
      stderr: "Syntax error on line 4",
    });

    const affected = await (p as any).handleHotUpdate(ctx);

    expect(affected).toEqual([]);
    expect(wsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        err: expect.objectContaining({
          message: "Compile error in broken.gleam",
          plugin: "vite-plugin-gleam",
          id: gleamFile,
        }),
      }),
    );
  });
});
