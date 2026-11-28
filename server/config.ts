import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Project root: the parent of this file's directory. */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Default location of the server configuration (IN1). */
export const DEFAULT_CONFIG_PATH = resolve(PROJECT_ROOT, 'server.config.json');

export interface ServerConfig {
  /** Absolute path of the template directory (IN1). */
  modelDir: string;
  /** Listening address; a local tool listens on 127.0.0.1 (AC3). */
  host: string;
  port: number;
}

/**
 * Reads and validates server.config.json. `modelDir` may be absolute or
 * relative to the configuration file. Throws an Error with a readable
 * message when the file or the directory is invalid.
 */
export function loadConfig(path: string = DEFAULT_CONFIG_PATH): ServerConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`Cannot read ${path}: ${(e as Error).message}`, { cause: e });
  }
  const config = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  if (typeof config.modelDir !== 'string' || config.modelDir === '') {
    throw new Error(`${path}: "modelDir" must be a non-empty string`);
  }
  const modelDir = isAbsolute(config.modelDir)
    ? config.modelDir
    : resolve(dirname(path), config.modelDir);
  let isDirectory = false;
  try {
    isDirectory = statSync(modelDir).isDirectory();
  } catch {
    // Reported below.
  }
  if (!isDirectory) {
    throw new Error(`${path}: template directory "${modelDir}" does not exist`);
  }

  const host = config.host ?? '127.0.0.1';
  if (typeof host !== 'string' || host === '') {
    throw new Error(`${path}: "host" must be a non-empty string`);
  }
  const port = config.port ?? 5180;
  if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${path}: "port" must be an integer between 1 and 65535`);
  }

  return { modelDir, host, port };
}
