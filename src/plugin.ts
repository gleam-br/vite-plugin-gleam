/**
 *
 * Vite plugin to gleam language.
 *
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { UserConfig } from "vite";
import MagicString from "magic-string";

import {
  isGleam,
  replaceId,
  getCompiledMjsPath,
  type GleamProject,
} from "./project";

import {
  GLEAM_SRC,
  GLEAM_BUILD,
  GLEAM_CONFIG,
  normalizePath,
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
  const { log, dir: { cwd } } = project;

  if (!importer) {
    log(`[resolve] skip: importer is empty`);
    log(`:> skip source ${source}`);
    return;
  } else if (source.startsWith("hex:")) {
    // resolve prefix `import * from "hex:<package>/<module>"`
    return resolveHex(project, source);
  }

  // Check if importer is a gleam file or a generated mjs file in build/
  const normalizedImporter = normalizePath(importer);
  const normalizedSource = normalizePath(source);

  // relative path
  const normalized = normalize(project, normalizedImporter, normalizedSource);

  if (!normalized) {
    return;
  }

  // relative path to gleam build dir, always POSIX normalized
  const baseDir = resolve(cwd, GLEAM_BUILD, dirname(normalized));
  const id = normalizePath(resolve(baseDir, normalizedSource));

  log(`[resolve] ok!`);
  log(`:>[resolve] normalized: ${normalized}`);
  log(`:>[resolve] id: ${id}`);
  return id;
}

/**
 * Load gleam file representation from compiled .mjs artifact.
 *
 * @param project Gleam project info.
 * @param id Module ID to load.
 * @returns Loaded code and map, or undefined if not a gleam file.
 */
export function load(
  project: GleamProject,
  id: string,
): { code: string; map: any } | undefined {
  if (!isGleam(id)) {
    return;
  }

  const { log, dir: { cwd } } = project;
  const normalizedId = normalizePath(id);

  // Calculate target mjs path
  let targetMjs = getCompiledMjsPath(project, normalizedId);
  if (!targetMjs) {
    const normalized = normalize(project, normalizedId);
    if (normalized) {
      targetMjs = normalizePath(resolve(cwd, GLEAM_BUILD, normalized));
    }
  }

  if (!targetMjs || !existsSync(targetMjs)) {
    log(`:>[load] compiled mjs not found for ${normalizedId}: ${targetMjs}`, true);
    return;
  }

  log(`:>[load] reading compiled ${targetMjs}`);
  const code = readFileSync(targetMjs, { encoding: "utf8" });

  return {
    code,
    map: null,
  };
}

/**
 * Transpile gleam file to js file representation (transform fallback).
 *
 * @param project Gleam project info.
 * @param projectFile Gleam current source file.
 * @param projectFileCode Gleam file code.
 * @returns Gleam code info, code and source map.
 */
export function transform(
  project: GleamProject,
  projectFile: string,
  projectFileCode: string,
): { code: string; map: any } | undefined {
  // If already transpiled JS/MJS code, skip
  if (!isGleam(projectFile)) {
    return;
  }

  const { log, dir: { cwd } } = project;
  const normalized = normalize(project, normalizePath(projectFile));

  if (!normalized) {
    return;
  }

  const path = normalizePath(resolve(cwd, GLEAM_BUILD, normalized));
  log(`:>[transform] path 'gleam' to 'mjs' ok!`);
  log(`:>[transform] reading...`);
  log(`:> path: ${path}`);

  if (!existsSync(path)) {
    log(`:>[transform] build file does not exist: ${path}`, true);
    return;
  }

  const file = readFileSync(path, { encoding: "utf8" });
  log(`:>[transform] reading ok!`);

  log(`:>[transform] sourcemap...`);
  const map = new MagicString(projectFileCode)
    .overwrite(0, Math.max(0, projectFileCode.length - 1), file)
    .generateMap({ source: projectFile, includeContent: true });
  log(`:>[transform] sourcemap ok!`);

  log(`[transform] ok!`);
  log(`:>[transform] file: ${projectFile}`);
  log(`:>[transform] path: ${path}`);

  return {
    code: file,
    map,
  };
}

/**
 * Config runtime exclude gleam ./build directory from Vite dev server and build watchers.
 * Prevents full reload loops during incremental gleam builds.
 *
 * @param config Config runtime.
 * @returns Config runtime.
 */
export function exclude(config: UserConfig): UserConfig {
  config.server ||= {};
  config.server.watch ||= {};

  // 1. Ignore Gleam build output in Vite dev server watcher
  const currentIgnored = config.server.watch.ignored;
  const gleamIgnoredPatterns = ["**/build/dev/javascript/**", "**/build/packages/**"];

  if (!currentIgnored) {
    config.server.watch.ignored = gleamIgnoredPatterns;
  } else if (Array.isArray(currentIgnored)) {
    config.server.watch.ignored = [...currentIgnored, ...gleamIgnoredPatterns];
  } else {
    config.server.watch.ignored = [currentIgnored as any, ...gleamIgnoredPatterns];
  }

  // 2. Ignore Gleam build output in Rollup / Vite build watch mode
  config.build ||= {};
  if (config.build.watch) {
    let origin = config.build.watch.exclude;
    if (!origin) {
      origin = [];
    } else if (typeof origin !== "object" || !Array.isArray(origin)) {
      origin = [origin as any];
    }
    origin.push("**/build/dev/javascript/**");
    config.build.watch.exclude = origin;
  }

  return config;
}

// PRIVATE
//

// Resolve prefix 'hex:'
export function resolveHex(project: GleamProject, source: string): string {
  const { log, dir: { out } } = project;
  const mod = replaceId(source.slice(4));

  if (!mod) {
    const error = `Empty module 'hex:'`;
    log(error, true);
    throw new Error(error);
  }

  const id = normalizePath(`${out}/${mod}`);

  log(`[resolve-hex] ok!`);
  log(`:>[resolve-hex] mod: ${mod}`);
  log(`:>[resolve-hex] path: ${id}`);
  return id;
}

// Normalize relative path to module inside build/dev/javascript
export function normalize(
  project: GleamProject,
  importer: string,
  source = "",
): string | undefined {
  const { cfg, log, dir: { cwd, src } } = project;

  // early skipping
  if (!isGleam(importer) && !source.endsWith("gleam.mjs") && !importer.includes(GLEAM_BUILD)) {
    log(`[resolve] skip: not gleam file`);
    log(`:> skip source ${source}`);
    log(`:> skip importer ${importer}`);
    return;
  }

  if (!cfg) {
    const error = `Not found ${src}/${GLEAM_CONFIG}`;
    log(error, true);
    throw new Error(`ERROR | ${error}`);
  }

  // replace importer .gleam with .mjs and normalize to POSIX
  const replaced = normalizePath(replaceId(importer));
  log(`:>[normalize] replaced ${replaced}`);

  // relative identification from cwd
  let path = normalizePath(relative(cwd, replaced));
  log(`:>[normalize] relative ${path}`);

  if (path.startsWith(`${GLEAM_SRC}/`)) {
    path = path.replace(`${GLEAM_SRC}/`, `${cfg.name}/`);
    log(`:>[normalize] 'src' to '${cfg.name}'`);
  }

  log(`[normalize] ok!`);
  log(`:>[normalize] ${path}`);
  log(`:>[normalize] source: ${source}`);
  log(`:>[normalize] importer: ${importer}`);
  return path;
}
