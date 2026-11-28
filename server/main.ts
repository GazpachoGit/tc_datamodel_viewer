import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildApp } from './app';
import { appPaths, loadConfig } from './config';
import { TemplateRepository } from './repository';

/**
 * Starts the local viewer service (AC3): reads the configuration and the
 * template list, then serves the API and, when built, the client.
 *
 * Usage: `node server.mjs [--config <path>]` (portable build) or
 * `tsx server/main.ts [--config <path>]` (sources).
 */
async function main(): Promise<void> {
  const paths = appPaths();
  const config = loadConfig(configArgument() ?? paths.configPath);
  const repository = await TemplateRepository.open(config.modelDir);

  const app = await buildApp({
    repository,
    staticDir: existsSync(resolve(paths.publicDir, 'index.html')) ? paths.publicDir : undefined,
  });
  await app.listen({ host: config.host, port: config.port });

  console.log(
    `Templates: ${repository.list().length} from ${config.modelDir}\n` +
      `Viewer:    http://${config.host}:${config.port}/`,
  );
}

/** The value of `--config <path>`, resolved against the working directory. */
function configArgument(): string | undefined {
  const index = process.argv.indexOf('--config');
  if (index === -1) {
    return undefined;
  }
  const value = process.argv[index + 1];
  if (!value) {
    throw new Error('--config requires a path');
  }
  return resolve(value);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
