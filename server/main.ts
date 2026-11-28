import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildApp } from './app';
import { PROJECT_ROOT, loadConfig } from './config';
import { TemplateRepository } from './repository';

/**
 * Starts the local viewer service (AC3): reads the configuration and the
 * template list, then serves the API and, when built, the client in dist/.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const repository = await TemplateRepository.open(config.modelDir);

  const distDir = resolve(PROJECT_ROOT, 'dist');
  const app = await buildApp({
    repository,
    staticDir: existsSync(resolve(distDir, 'index.html')) ? distDir : undefined,
  });
  await app.listen({ host: config.host, port: config.port });

  console.log(
    `Templates: ${repository.list().length} from ${config.modelDir}\n` +
      `Viewer:    http://${config.host}:${config.port}/`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
