/**
 *
 * Vite plugin to gleam language.
 *
 */

import { readFileSync } from "fs";
import { join, relative, resolve, sep } from "path";

import type { UserConfig } from "vite";

import MagicString from "magic-string";

import {
  isGleam,
  replaceId,
  type GleamProject
} from "./project";

import {
  GLEAM_SRC,
  GLEAM_BUILD,
  GLEAM_CONFIG,
} from "./util";

/**
 * Resolve the identification file/path gleam to mjs.
 *
 * @param project Gleam project info.
 * @param source Path to source imported by
 * @param importer Path to importer of source
 * @returns Resolved identification gleam to mjs file.
 */
export function resolveId(
  project: GleamProject,
  source: string,
  importer: string | undefined,
): string | undefined {
  const { log, dir: { cwd } } = project

  if (!importer) {

    log(`[resolve] skip: importer is empty`)
    log(`:> skip source ${source}`)
    return;

  } else if (source.startsWith("hex:")) {

    // resolve prefix `import * from "hex:<relative>/<module>"`
    return resolveHex(project, source);

  }

  // relative path
  const normalized = normalize(project, importer, source);

  if (!normalized) {
    // skipping nothing to do
    return;
  }

  // relative path to gleam build dir
  const id = join(cwd, GLEAM_BUILD, normalized, "..", source);

  log(`[resolve] ok!`);
  log(`:>[resolve] normalized: ${normalized}`);
  log(`:>[resolve] id: ${id}`);
  return id;
}

/**
 * Transpile gleam file to js file representation.
 *
 * @param projectName Gleam project name.
 * @param projectFile Gleam current source file.
 * @param projectFileCode Gleam file code.
 * @param project Gleam project info.
 * @returns Gleam code info, code and source map.
 */
export function transform(
  project: GleamProject,
  projectFile: string,
  projectFileCode: string,
): { code: string, map: any } | undefined {
  const { log, dir: { cwd } } = project;
  // relative path
  const normalized = normalize(project, projectFile);

  if (!normalized) {
    // skipping nothing to do
    return;
  }

  const path = `${cwd}${sep}${GLEAM_BUILD}${sep}${normalized}`;
  log(`:>[transform] path 'gleam' to 'mjs' ok!`);

  log(`:>[transform] reading...`);
  log(`:> path: ${path}`);
  const file = readFileSync(path, { encoding: "utf8" });
  log(`:>[transform] reading ok!`);

  log(`:>[transform] sourcemap...`);
  const map = new MagicString(projectFileCode)
    .overwrite(0, projectFileCode.length - 1, file)
    .generateMap({ source: projectFile, includeContent: true });
  log(`:>[transform] sourcemap ok!`);

  log(`[transform] ok!`);
  log(`:>[transform] file: ${projectFile}`);
  log(`:>[transform] path: ${path}`);

  return {
    code: file,
    map: map,
  };
}

/**
 * Config runtime exclude gleam ./build directory.
 *
 * @param config Config runtime.
 * @returns Config runtime.
 */
export function exclude(config: UserConfig): UserConfig | undefined {
  config.build ||= {};

  if (config.build.watch === null || config.build.watch === undefined) {
    return;
  }

  if (typeof config.build.watch !== "object") {
    config.build.watch = {};
  }

  let origin = config.build.watch!.exclude;

  if (!origin) {
    origin = [];
  } else if (typeof origin !== "object") {
    origin = [origin];
  }

  (<string[]>origin).push("build/**");
  config.build.watch!.exclude = origin;

  console.log(`[config-vite] watch exclude 'build/**'`);
  return config;
}

// PRIVATE
//

// Resolve prefix 'hex:'
//
function resolveHex(project: GleamProject, source: string): string {
  const { log, dir: { out } } = project;
  const mod = replaceId(source.slice(4));

  if (!mod) {
    const error = `Empty module 'hex:'`;

    log(error, true);
    throw new Error(error);
  }

  const id = join(out, mod);

  log(`[resolve-hex] ok!`);
  log(`:>[resolve-hex] mod: ${mod}`)
  log(`:>[resolve-hex] path: ${id}`)
  return id;
}

// Normalize relative path
//
function normalize(
  project: GleamProject,
  importer: string,
  source = ""
): string | undefined {
  const { cfg, log, dir: { cwd, src } } = project;

  // early skipping
  if (!isGleam(importer) && !source.endsWith("gleam.mjs")) {
    log(`[resolve] skip: not gleam file`)
    log(`:> skip source ${source}`)
    log(`:> skip importer ${importer}`)
    return;
  };

  if (!cfg) {
    const error = `Not found ${src}${sep}${GLEAM_CONFIG}`;

    log(error, true);
    throw Error(`ERROR | ${error}`)
  }

  // replace importer
  const replaced = replaceId(importer);
  log(`:>[normalize] replaced ${replaced}`);
  // relative identification
  let path = relative(cwd, replaced);
  log(`:>[normalize] relative ${path}`);

  if (path.startsWith(GLEAM_SRC)) {
    path = path.replace(`${GLEAM_SRC}${sep}`, `${cfg?.name}${sep}`);
    log(`:>[normalize] 'src' to '${cfg?.name}'`);
  }

  log(`[normalize] ok!`);
  log(`:>[normalize] ${path}`);
  log(`:>[normalize] source: ${source}`);
  log(`:>[normalize] importer: ${importer}`);
  return path;
}
