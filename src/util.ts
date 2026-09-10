/**
 *
 * Gleam vite plugin utils constant and functions.
 *
 */

import { name, version } from "../package.json";

/** Plugin name from package.json */
export const PLUGIN_NAME: string = name;

/** Plugin version from package.json */
export const PLUGIN_VRN: string = version;

/** Gleam binary file */
export const GLEAM_BIN = "gleam";

/** Gleam source dir */
export const GLEAM_SRC: string = "src";

/** Gleam build dir (POSIX style for Vite/Rollup/Rolldown compatibility) */
export const GLEAM_BUILD: string = "build/dev/javascript";

/** Default location of gleam config file */
export const GLEAM_CONFIG: string = "gleam.toml";

/** Regex of gleam config file */
export const GLEAM_REGEX_CONFIG: RegExp = /gleam\.toml$/;

/** Regex of gleam file extension */
export const GLEAM_REGEX_FILE: RegExp = /\.gleam$/;

/** Gleam constraint to filter gleam files */
export const CONSTRAINTS: { filter: RegExp } = { filter: GLEAM_REGEX_FILE };

/** Extension files */
export enum Ext {
  gleam = ".gleam",
  mjs = ".mjs",
  ts = ".ts",
  dts = ".dts",
}

/** Log level plugin */
export enum LogLevel {
  none = "none",
  trace = "trace",
  debug = "debug",
  info = "info",
}

/**
 * Normalizes Windows backslashes to standard POSIX forward slashes.
 * Crucial for Vite, Rollup, and Rolldown module ID consistency across platforms.
 *
 * @param id Path or module ID to normalize.
 * @returns Normalized POSIX path.
 */
export function normalizePath(id: string): string {
  return id.replace(/\\/g, "/");
}

/**
 * Log from high order function passing level and if has time in log.
 *
 * @param level Log level.
 * @param time If date and time should be prepended.
 */
export const logger = (level: LogLevel, time = false) => {
  const isNone = level === "none";
  const isTrace = level === "trace";
  const isDebug = isTrace || level === "debug";
  const isInfo = !isDebug;

  return (msg: string, error = false): void => {
    const isCmd = msg.startsWith("$ ");

    if ((isNone && !isCmd) || (!isTrace && msg.includes("skip"))) {
      return;
    }

    const prefix = msg.startsWith(":>") ? "[debug]" : "";

    if (!isCmd && !error && isInfo && prefix !== "") {
      return;
    }

    const prefixTime = time === true ? `${new Date().toISOString()} ` : "";
    const logMethod = error ? console.error : console.log;
    logMethod(`${prefixTime}[${PLUGIN_NAME}]${prefix}${error ? " ERROR |" : ""} ${msg}`);
  };
};
