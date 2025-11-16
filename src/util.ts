/**
 *
 * Gleam vite plugin utils constant and functions.
 *
 */

import { sep } from "node:path";
import { name } from "../package.json";

/** Plugin name from package.json */
export const PLUGIN_NAME: string = name;

/** Gleam binary file */
export const GLEAM_BIN = "gleam";

/** Gleam source dir */
export const GLEAM_SRC: string = "src";

/** Gleam build dir */
export const GLEAM_BUILD: string = `build${sep}dev${sep}javascript`;

/** Default location of gleam config file */
export const GLEAM_CONFIG: string = `gleam.toml`;

/** Regex of gleam config file */
export const GLEAM_REGEX_CONFIG: RegExp = /gleam\.toml$/;

/** Regex of gleam file extension */
export const GLEAM_REGEX_FILE: RegExp = /\.gleam$/;

/** Gleam file extension */
export const EXT_GLEAM: string = ".gleam";

/** Mjs file extension */
export const EXT_MJS: string = ".mjs";

/** Gleam constraint to filter gleam files */
export const CONSTRAINTS: { filter: RegExp } = { filter: GLEAM_REGEX_FILE }

/**
 * Log from high order function passing level and if has time in log.
 *
 * @param msg Message log.
 * @param error if error or not.
 */
export const logger = (level: string, time = false) => {
  const isNone = level === "none";
  const isTrace = level === "trace";
  const isDebug = isTrace || level === "debug";
  const isInfo = !isDebug;

  // console.log(msg)
  return (msg: string, error = false): void => {
    const isCmd = msg.startsWith("$ ");

    if ((isNone && !isCmd) || (!isTrace && msg.includes("skip"))) {
      return;
    }

    const prefix = msg.startsWith(":>") ? "[debug]" : "";

    if (!isCmd && !error && isInfo && prefix !== "") {
      return;
    }

    const prefixTime = time === true ? `${new Date().toISOString()}` : "";
    console.log(`${prefixTime}[${PLUGIN_NAME}]${prefix}${error ? " ERROR |" : ""} ${msg}`);
  }
}
