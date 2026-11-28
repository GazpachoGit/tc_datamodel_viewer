import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { ModelError } from '../src/model/types';
import type { TemplateRepository } from './repository';

export interface AppOptions {
  repository: TemplateRepository;
  /** Directory of the built client to serve; omitted in dev and tests. */
  staticDir?: string;
  logger?: boolean;
}

/**
 * HTTP API of the viewer (design.md, API):
 * - `GET /api/templates` — template list (LT1, UI10);
 * - `GET /api/templates/:name` — built model of one template (TL1-TL6).
 * Invalid input (IV*) answers 422 with `{ message }`, an unknown template 404.
 */
export async function buildApp({
  repository,
  staticDir,
  logger = false,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  app.get('/api/templates', async () => repository.list());

  app.get<{ Params: { name: string } }>('/api/templates/:name', async (request, reply) => {
    const info = repository.find(request.params.name);
    if (!info) {
      return reply.code(404).send({ message: `Template "${request.params.name}" not found` });
    }
    try {
      return await repository.loadTemplate(info);
    } catch (e) {
      if (e instanceof ModelError) {
        return reply.code(422).send({ message: e.message });
      }
      throw e;
    }
  });

  if (staticDir) {
    await app.register(fastifyStatic, { root: staticDir });
  }

  return app;
}
