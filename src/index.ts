/**
 *
 * Gleam vite plugin to gleam langueage files.
 *
 */

import type {
  Plugin,
  UserConfig,
  ConfigEnv,
  HmrContext,
} from "vite";

import {
  exclude,
  resolveId,
  transform,
} from "./plugin";

import {
  projectNew,
  projectConfig,
  projectBuild,
  isGleam,
} from "./project";

import {
  PLUGIN_NAME,
} from "./util";

/**
 * Gleam plugin to vite runtime.
 *
 * @param options Gleam plugin options.
 * @returns Vite plugin interface.
 */
export default function plugin(options: any | undefined): Plugin {
  let prj = projectNew(options);

  return {
    name: PLUGIN_NAME,
    config(config: UserConfig, _env: ConfigEnv) {
      return exclude(config);
    },
    resolveId(source: string, importer: string | undefined) {
      return resolveId(prj, source, importer);
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
    async handleHotUpdate(ctx: HmrContext) {
      if (isGleam(ctx.file)) {
        await projectBuild(prj);

        prj.log(`[hotUpdate] ok!`);
        prj.log(`:>[hotUpdate] file: ${ctx.file}`)
      }
    },
  };
}
