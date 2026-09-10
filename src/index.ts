/**
 *
 * Gleam vite plugin to gleam language files.
 *
 */

import type {
  Plugin,
  UserConfig,
  ConfigEnv,
  HmrContext,
  ModuleNode,
} from "vite";

import {
  exclude,
  resolveId,
  load,
  transform,
} from "./plugin";

import {
  projectNew,
  projectConfig,
  projectBuild,
  getCompiledMjsPath,
  isGleam,
  type GleamPlugin,
  type GleamProject,
  type GleamConfig,
  type GleamDir,
  type GleamBuild,
  type GleamBuildOut,
} from "./project";

import {
  PLUGIN_NAME,
  LogLevel,
  Ext,
} from "./util";

export type {
  GleamPlugin,
  GleamProject,
  GleamConfig,
  GleamDir,
  GleamBuild,
  GleamBuildOut,
};

export { LogLevel, Ext };

/**
 * Gleam plugin to vite runtime.
 *
 * @param options Gleam plugin options.
 * @returns Vite plugin interface.
 */
export default function plugin(options?: GleamPlugin): Plugin {
  let prj = projectNew(options);

  return {
    name: PLUGIN_NAME,
    config(config: UserConfig, _env: ConfigEnv) {
      return exclude(config);
    },
    resolveId(source: string, importer: string | undefined) {
      return resolveId(prj, source, importer);
    },
    load(id: string) {
      return load(prj, id);
    },
    transform(code: string, id: string) {
      return transform(prj, id, code);
    },
    async buildStart() {
      // refresh config gleam.toml
      prj = await projectConfig(prj);

      // build function singleton
      await projectBuild(prj, true);

      prj.log(`[buildStart] ok!`);
    },
    async handleHotUpdate(ctx: HmrContext): Promise<ModuleNode[] | void> {
      if (!isGleam(ctx.file)) {
        return;
      }

      try {
        await projectBuild(prj);
        prj.log(`[hotUpdate] ok!`);
        prj.log(`:>[hotUpdate] file: ${ctx.file}`);
      } catch (err: any) {
        // Send structured error to Vite browser error overlay
        ctx.server.ws.send({
          type: "error",
          err: {
            message: err.message || "Gleam compilation failed",
            stack: err.stderr || err.stdout || err.stack || "",
            plugin: PLUGIN_NAME,
            id: ctx.file,
          },
        });
        // Prevent broken module updates from crashing the browser runtime
        return [];
      }

      // High performance O(1) module resolution and invalidation
      const affectedModules = new Set<ModuleNode>(ctx.modules);

      // Invalidate the .gleam module nodes
      for (const mod of ctx.modules) {
        ctx.server.moduleGraph.invalidateModule(mod);
      }

      // Look up and invalidate the corresponding compiled .mjs module in Vite moduleGraph
      const mjsPath = getCompiledMjsPath(prj, ctx.file);

      if (mjsPath) {
        const mjsMod = ctx.server.moduleGraph.getModuleById(mjsPath);
        if (mjsMod) {
          ctx.server.moduleGraph.invalidateModule(mjsMod);
          affectedModules.add(mjsMod);
        }
      }

      return Array.from(affectedModules);
    },
  };
}
