import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Set to true by the portable build (scripts/build-server.mjs). */
declare const __BUNDLED__: boolean | undefined;

export interface AppPaths {
  /** Default server configuration file (IN1). */
  configPath: string;
  /** Built client served at `/`. */
  publicDir: string;
}

/**
 * Locations of the configuration and the built client:
 * - from sources (`tsx server/main.ts`): the repository root holds
 *   server.config.json, and the client is built into dist/public;
 * - from the portable build (`node dist/server.mjs`): both lie next to
 *   server.mjs.
 */
export function appPaths(): AppPaths {
  const here = dirname(fileURLToPath(import.meta.url));
  const bundled = typeof __BUNDLED__ !== 'undefined' && __BUNDLED__;
  const root = bundled ? here : resolve(here, '..');
  return {
    configPath: resolve(root, 'server.config.json'),
    publicDir: bundled ? resolve(root, 'public') : resolve(root, 'dist', 'public'),
  };
}

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
export function loadConfig(path: string = appPaths().configPath): ServerConfig {
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
