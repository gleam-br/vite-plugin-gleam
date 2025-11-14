/**
 * Gleam BR vite plugin to gleam files
 */

import { join } from "node:path";

import type {
  Plugin,
  UserConfig,
  ConfigEnv,
  HmrContext,
} from "vite";

import {
  projectNew,
  projectBuild,
  projectConfig,
  transpile,
  resolveId,
  isGleamFile,
  configExclude,
} from "core-plugin-gleam";

const PLUGIN_NAME = "vite-plugin-gleam";

let projectName: string | undefined = undefined;

/**
 * Gleam plugin to vite runtime.
 *
 * @param options Gleam plugin options.
 * @returns Vite plugin interface.
 */
export default function plugin(options: any | undefined): Plugin {
  const project = projectNew(options);
  const build = projectBuild(project);
  const { cfg, dir: { out } } = project;

  return {
    name: PLUGIN_NAME,
    config(config: UserConfig, _env: ConfigEnv) {
      return configExclude(config);
    },
    resolveId(source: string, importer: string | undefined) {
      if (!importer) {
        return;
      }

      if (source.startsWith("hex:")) {
        const path = join(out, source.slice(4));
        return { id: path };
      }

      if (!isGleamFile(importer) && !source.endsWith("gleam.mjs")) {
        return;
      };

      if (!projectName) {
        throw new Error(`Not found project name from ${cfg}`)
      }

      return {
        id: resolveId(projectName, importer, project),
      };
    },
    transform(code: string, id: string) {
      if (!isGleamFile(id)) {
        return;
      }

      if (!projectName) {
        throw new Error(`Not found project name from ${cfg}`)
      }

      return transpile(projectName, id, code, project);
    },
    async buildStart() {
      // read gleam.toml reloading project name
      projectName = projectConfig(project).name;
      await build();
    },
    async handleHotUpdate(ctx: HmrContext) {
      if (isGleamFile(ctx.file)) {
        await build();
      }
    },
  };
}
