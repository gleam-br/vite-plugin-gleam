/**
 *
 * Gleam vite plugin project functions.
 *
 */

import { promisify } from "node:util";
import { join, resolve } from "node:path";

import {
  lstat as lstatCallback,
  readFile as readFileCallback,
} from "node:fs";

import { cwd as processCwd } from "node:process";
import { exec as execCallback } from "node:child_process";

import { parse } from "toml";

import { execa } from "execa";

import {
  PLUGIN_VRN,
  GLEAM_BIN,
  GLEAM_SRC,
  GLEAM_BUILD,
  GLEAM_CONFIG,
  GLEAM_REGEX_FILE,
  GLEAM_REGEX_CONFIG,
  EXT_GLEAM,
  EXT_MJS,
  logger,
} from "./util";

// promisify
const lstat = promisify(lstatCallback);
const readFile = promisify(readFileCallback);

/**
 * Gleam project info.
 */
export interface GleamProject {
  bin: string,
  // undefined when no read gleam.toml yet
  cfg: GleamConfig | undefined,
  // util.logger(level)
  log: any,
  dir: GleamDir,
  build: GleamBuild,
}

/**
 * Gleam config info from gleam.toml file.
 */
export interface GleamConfig {
  name: string;
  version: string;
  target: string;
  javascript: {
    typescript_declarations: boolean
  }
}

export interface GleamDir {
  cwd: string
  src: string
  out: string
}

/**
 * Gleam plugin options.
 */
export interface GleamPlugin {
  cwd: string;
  bin: string;
  log: {
    time: boolean,
    level: "info" | "debug" | "trace" | "none"
  }
  build: GleamBuild;
}

/**
 * Gleam build options.
 */
export interface GleamBuild {
  noPrintProgress: boolean;
  warningsAsErrors: boolean;
}

/**
 * Gleam build output.
 */
export interface GleamBuildOut {
  stdout: string
  stderr: string
}

/** Gleam options default */
const GLEAM_OPT_EMPTY = {
  bin: GLEAM_BIN,
  log: { time: false, level: "none" },
  cwd: processCwd(),
  build: {
    noPrintProgress: true,
    warningsAsErrors: false,
  }
} as GleamPlugin;

/**
 * Get gleam project info from plugin options.
 *
 * @param options Gleam plugin options.
 * @returns Project info like gleam binary, directories and more.
 */
export function projectNew(options: any | undefined): GleamProject {
  const opts = getPluginOpts(options);
  const { cwd, bin, log: { level, time }, build: { noPrintProgress, warningsAsErrors } } = opts
  // Gleam expects a project to have `src/` directory at project root.
  const src = resolve(cwd, GLEAM_SRC);
  // Gleam compiler outputs artifacts under `build/` directory at project root.
  // Directory structure inside is not documentated, but this is the only way
  // to access built JS files. There is no way to specify output directory also.
  const out = resolve(cwd, GLEAM_BUILD);
  // log instance with level and has time prefix
  const log = logger(level, time)

  log(`$ STARTUP OK ${PLUGIN_VRN} !`);
  log(`:> bin: '${bin}'`);
  log(`:> cwd: '${cwd}'`);
  log(`:> log.time: '${time}'`);
  log(`:> log.level: '${level}'`);

  return {
    bin,
    cfg: undefined,
    log,
    dir: {
      cwd,
      src,
      out,
    },
    build: {
      noPrintProgress,
      warningsAsErrors
    }
  };
}

/**
 * Get gleam.toml info.
 *
 * @param project Gleam project.
 * @returns Gleam config.
 * @see GleamProject
 * @see GleamConfig
 */
export async function projectConfig(project: GleamProject): Promise<GleamProject> {
  const { log, dir: { cwd } } = project;
  const path = join(cwd, GLEAM_CONFIG);

  if (!isConfig(path)) {
    const error = `Not found ${path}`;

    log(error, true);
    throw new Error(`ERROR | ${error}`);
  }

  const configFile = await lstat(path);

  if (!configFile.isFile()) {
    const error = `Not a file ${path} `;

    log(error, true);
    throw new Error(`ERROR | ${error}`);
  }

  const file = await readFile(path, { encoding: "utf8" });
  const config = parse(file);

  const projectWithCfg = {
    ...project,
    cfg: config
  } as GleamProject;

  log(`[config-gleam] ok!`);
  log(`:>[config-gleam] name: '${config.name}'`);
  log(`:>[config-gleam] version: ${config.version}`);
  log(`:>[config-gleam] typescript_declarations: ${config.javascript?.typescript_declarations}`);
  return projectWithCfg;
}

/**
 * Gleam build to target javascript.
 *
 * @param bin Gleam binary location.
 * @param projectDirRoot Gleam project root location of gleam.toml.
 * @param noPrintProgress Gleam --no-print-progress build arg.
 * @param warningsAsErrors Gleam --warnings-as-errors build arg.
 *
 * @returns Promisify executing gleam build.
 */
export async function projectBuild(project: GleamProject): Promise<GleamBuildOut> {
  const {
    bin,
    log,
    dir: { cwd },
    build: { noPrintProgress, warningsAsErrors }
  } = project;

  const args = ["build", "--target", "javascript"];

  if (warningsAsErrors) {
    args.push("--warnings-as-errors");
  }

  if (noPrintProgress) {
    args.push("--no-print-progress");
  }

  const cmd = `${bin} ${args.join(" ")}`

  try {
    log(`$ ${cmd}`);
    const res = await execa(bin, args, { cwd, encoding: "utf8", timeout: 5000 });
    const out = `${res.stdout}${res.stderr}`;

    if (out) {
      log(`out: ${out}`);
    }

    log(`:>[build] ${res.durationMs}ms`)
    return res;
  } catch (err) {
    log(`Failed '${cmd}`, true);
    throw err;
  }
}

/**
 * Replace file path from gleam to param ext correspondent file.
 *
 * @param file File path to replaced.
 * @param ext Extension to replaced.
 * @returns File path replaced to extension.
 */
export function replaceId(file: string, ext: string = EXT_MJS): string {
  return file.replace(GLEAM_REGEX_FILE, ext);
}


/**
 * Is file a gleam file .gleam and is relative.
 *
 * @param file Path file to check.
 * @returns If is gleam file or not.
 */
export function isGleam(file: string): boolean {
  return endsWith(file, EXT_GLEAM) || GLEAM_REGEX_FILE.test(file);
}

// PRIVATE
//

// Get options, GleamPlugin, from any.
//
function getPluginOpts(options: any | undefined): GleamPlugin {
  if (!options || typeof options !== "object") {
    return GLEAM_OPT_EMPTY;
  }
  const bin = options.bin
    ? options.bin
    : typeof options.build?.bin === "string"
      ? options.build?.bin
      : GLEAM_BIN;
  const cwd = options.cwd
    ? options.cwd
    : typeof options.build?.config === "string"
      ? options.build?.config
      : processCwd();
  const level = typeof options.log === "string"
    ? options.log
    : typeof options.log?.level === "string"
      ? options.log?.level
      : "none";
  const time = options.time === true
    || options.log?.time === true;
  const warningsAsErrors = options.warningsAsErrors === true
    || options.build?.warningsAsErrors === true;
  const noPrintProgress = !(options.noPrintProgress === false
    || options.build?.noPrintProgress === false);

  return {
    cwd,
    bin,
    log: {
      level,
      time
    },
    build: {
      noPrintProgress,
      warningsAsErrors,
    }
  };
}

// Is config gleam file 'gleam.toml'
//
function isConfig(file: string = GLEAM_CONFIG): boolean {
  return endsWith(file, GLEAM_CONFIG) || GLEAM_REGEX_CONFIG.test(file);
}

// String word ends with term
//
function endsWith(word: string, term: string): boolean {
  return word ? word.endsWith(term) : false;
}
