/**
 *
 * Gleam vite plugin project functions.
 *
 */

import { promisify } from "node:util";
import { resolve } from "node:path";
import {
  lstat as lstatCallback,
  readFile as readFileCallback,
} from "node:fs";
import { cwd as processCwd } from "node:process";
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
  Ext,
  logger,
  LogLevel,
  normalizePath,
} from "./util";

// promisify
const lstat = promisify(lstatCallback);
const readFile = promisify(readFileCallback);

/**
 * Gleam project info.
 */
export interface GleamProject {
  bin: string;
  // undefined when no read gleam.toml yet
  cfg: GleamConfig | undefined;
  // util.logger(level)
  log: (msg: string, error?: boolean) => void;
  dir: GleamDir;
  build: GleamBuild;
}

/**
 * Gleam config info from gleam.toml file.
 */
export interface GleamConfig {
  name: string;
  version: string;
  target: string;
  javascript?: {
    typescript_declarations?: boolean;
  };
}

export interface GleamDir {
  cwd: string;
  src: string;
  out: string;
}

/**
 * Gleam plugin options.
 */
export interface GleamPlugin {
  cwd?: string;
  bin?: string;
  log?: {
    time?: boolean;
    level?: LogLevel | "none" | "trace" | "debug" | "info";
  } | LogLevel | "none" | "trace" | "debug" | "info";
  time?: boolean;
  warningsAsErrors?: boolean;
  noPrintProgress?: boolean;
  build?: {
    bin?: string;
    config?: string;
    noPrintProgress?: boolean;
    warningsAsErrors?: boolean;
  };
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
  stdout: string;
  stderr: string;
  durationMs?: number;
}

/** Gleam options default */
const GLEAM_OPT_EMPTY: {
  cwd: string;
  bin: string;
  log: { time: boolean; level: LogLevel };
  build: GleamBuild;
} = {
  bin: GLEAM_BIN,
  log: { time: false, level: LogLevel.none },
  cwd: processCwd(),
  build: {
    noPrintProgress: true,
    warningsAsErrors: false,
  },
};

/**
 * Get gleam project info from plugin options.
 *
 * @param options Gleam plugin options.
 * @returns Project info like gleam binary, directories and more.
 */
export function projectNew(options?: GleamPlugin): GleamProject {
  const opts = getPluginOpts(options);
  const cwd = normalizePath(opts.cwd);
  const bin = opts.bin;
  const { level, time } = opts.log;
  const { noPrintProgress, warningsAsErrors } = opts.build;

  // Gleam expects a project to have `src/` directory at project root.
  const src = normalizePath(resolve(cwd, GLEAM_SRC));
  // Gleam compiler outputs artifacts under `build/dev/javascript` directory at project root.
  const out = normalizePath(resolve(cwd, GLEAM_BUILD));

  // log instance with level and has time prefix
  const log = logger(level as LogLevel, time);

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
      warningsAsErrors,
    },
  };
}

/**
 * Get gleam.toml info.
 *
 * @param project Gleam project.
 * @returns Gleam config.
 */
export async function projectConfig(project: GleamProject): Promise<GleamProject> {
  const { log, dir: { cwd } } = project;
  const path = resolve(cwd, GLEAM_CONFIG);

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
  const config = parse(file) as GleamConfig;

  const projectWithCfg: GleamProject = {
    ...project,
    cfg: config,
  };

  log(`[config-gleam] ok!`);
  log(`:>[config-gleam] name: '${config.name}'`);
  log(`:>[config-gleam] version: ${config.version}`);
  log(`:>[config-gleam] typescript_declarations: ${config.javascript?.typescript_declarations}`);
  return projectWithCfg;
}

/**
 * Gleam build to target javascript.
 *
 * @param project Gleam project.
 * @param silent If true, suppresses non-critical command error logs.
 * @returns Promisify executing gleam build.
 */
export async function projectBuild(project: GleamProject, silent = false): Promise<GleamBuildOut> {
  const {
    bin,
    log,
    dir: { cwd },
    build: { noPrintProgress, warningsAsErrors },
  } = project;

  const args = ["build", "--target", "javascript"];

  if (warningsAsErrors) {
    args.push("--warnings-as-errors");
  }

  if (noPrintProgress) {
    args.push("--no-print-progress");
  }

  const cmd = `${bin} ${args.join(" ")}`;

  try {
    log(`$ ${cmd}`);
    const res = await execa(bin, args, { cwd, encoding: "utf8", timeout: 30000 });
    const out = `${res.stdout || ""}${res.stderr || ""}`;

    if (out) {
      log(`out: ${out}`);
    }

    if (res.durationMs !== undefined) {
      log(`:>[build] ${res.durationMs}ms`);
    }
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      durationMs: res.durationMs,
    };
  } catch (err: any) {
    log(`${!silent ? "$" : ""} ${err}`, true);
    throw err;
  }
}

/**
 * Calculate the corresponding compiled `.mjs` file path for a `.gleam` file.
 * O(1) performance without disk scanning.
 *
 * @param project Gleam project info.
 * @param gleamFile Absolute or relative path to a .gleam file.
 * @returns Normalized POSIX path to the generated .mjs file in build/dev/javascript/<pkg>/...
 */
export function getCompiledMjsPath(project: GleamProject, gleamFile: string): string | undefined {
  const { cfg, dir: { cwd, src, out } } = project;
  if (!cfg?.name) return undefined;

  const normalized = normalizePath(gleamFile);
  const normalizedSrc = normalizePath(src);

  let rel: string;
  if (normalized.startsWith(normalizedSrc)) {
    rel = normalized.slice(normalizedSrc.length).replace(/^\/+/, "");
  } else {
    const normalizedCwd = normalizePath(cwd);
    const fromCwd = normalized.startsWith(normalizedCwd)
      ? normalized.slice(normalizedCwd.length).replace(/^\/+/, "")
      : normalized;

    if (fromCwd.startsWith(`${GLEAM_SRC}/`)) {
      rel = fromCwd.slice(`${GLEAM_SRC}/`.length);
    } else {
      rel = fromCwd;
    }
  }

  const mjsRel = rel.replace(GLEAM_REGEX_FILE, Ext.mjs);
  return `${out}/${cfg.name}/${mjsRel}`;
}

/**
 * Replace file path from gleam to param ext correspondent file.
 *
 * @param file File path to replaced.
 * @param ext Extension to replaced.
 * @returns File path replaced to extension.
 */
export function replaceId(file: string, ext: string = Ext.mjs): string {
  return file.replace(GLEAM_REGEX_FILE, ext);
}

/**
 * Is file a gleam file .gleam.
 *
 * @param file Path file to check.
 * @returns If is gleam file or not.
 */
export function isGleam(file: string): boolean {
  return endsWith(file, Ext.gleam) || GLEAM_REGEX_FILE.test(file);
}

// PRIVATE
//

// Get options, GleamPlugin, from any.
export function getPluginOpts(options: any | undefined): {
  cwd: string;
  bin: string;
  log: { level: string; time: boolean };
  build: { noPrintProgress: boolean; warningsAsErrors: boolean };
} {
  if (!options || typeof options !== "object") {
    return {
      cwd: GLEAM_OPT_EMPTY.cwd,
      bin: GLEAM_OPT_EMPTY.bin,
      log: { ...GLEAM_OPT_EMPTY.log },
      build: { ...GLEAM_OPT_EMPTY.build },
    };
  }

  const bin = options.bin
    ? options.bin
    : typeof options.build?.bin === "string"
      ? options.build.bin
      : GLEAM_BIN;

  const cwd = options.cwd
    ? options.cwd
    : typeof options.build?.config === "string"
      ? options.build.config
      : processCwd();

  const level = typeof options.log === "string"
    ? options.log
    : typeof options.log?.level === "string"
      ? options.log.level
      : "none";

  const time = options.time === true || options.log?.time === true;

  const warningsAsErrors =
    options.warningsAsErrors === true || options.build?.warningsAsErrors === true;

  const noPrintProgress = !(
    options.noPrintProgress === false || options.build?.noPrintProgress === false
  );

  return {
    cwd,
    bin,
    log: {
      level,
      time,
    },
    build: {
      noPrintProgress,
      warningsAsErrors,
    },
  };
}

// Is config gleam file 'gleam.toml'
function isConfig(file: string = GLEAM_CONFIG): boolean {
  return endsWith(file, GLEAM_CONFIG) || GLEAM_REGEX_CONFIG.test(file);
}

// String word ends with term
function endsWith(word: string, term: string): boolean {
  return word ? word.endsWith(term) : false;
}
