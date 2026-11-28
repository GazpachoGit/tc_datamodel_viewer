import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TemplateModelDto } from '../src/model/dto';
import type { TemplateInfo } from '../src/model/types';
import { buildApp } from './app';
import { PROJECT_ROOT, loadConfig } from './config';
import { TemplateRepository } from './repository';

const NS = 'http://teamcenter.com/BusinessModel/TcBusinessData';

describe('API on a small template directory', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'tc-viewer-'));
    const write = (file: string, text: string) => writeFileSync(join(dir, file), text);
    write(
      'base_dependency.xml',
      '<TcBusinessDataIncludes name="base" displayName="Base"/>',
    );
    write(
      'base_template.xml',
      `<TcBusinessData xmlns="${NS}">
         <TcClass className="Root"/>
         <TcClass className="Mid" parentClassName="Root"/>
       </TcBusinessData>`,
    );
    write(
      'app_dependency.xml',
      `<TcBusinessDataIncludes name="app" displayName="Application">
         <include file="base_template.xml"/>
       </TcBusinessDataIncludes>`,
    );
    write(
      'app_template.xml',
      `<TcBusinessData xmlns="${NS}"><TcClass className="Leaf" parentClassName="Mid"/></TcBusinessData>`,
    );
    // Broken: duplicate attribute (IV1).
    write(
      'bad_dependency.xml',
      '<TcBusinessDataIncludes name="bad" displayName="Broken"/>',
    );
    write(
      'bad_template.xml',
      `<TcBusinessData xmlns="${NS}">
         <TcClass className="X">
           <TcAttribute attributeName="a" attributeType="POM_int"/>
           <TcAttribute attributeName="a" attributeType="POM_int"/>
         </TcClass>
       </TcBusinessData>`,
    );
    // Not listed: no template file (IN3).
    write('orphan_dependency.xml', '<TcBusinessDataIncludes name="orphan"/>');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  async function app() {
    return buildApp({ repository: await TemplateRepository.open(dir) });
  }

  it('lists templates sorted by display name (LT1, UI10)', async () => {
    const response = await (await app()).inject('/api/templates');
    expect(response.statusCode).toBe(200);
    const list = response.json<TemplateInfo[]>();
    expect(list.map((t) => t.displayName)).toEqual(['Application', 'Base', 'Broken']);
  });

  it('returns the built model of a template (TL1-TL6)', async () => {
    const response = await (await app()).inject('/api/templates/app');
    expect(response.statusCode).toBe(200);
    const body = response.json<TemplateModelDto>();
    expect(body.info.name).toBe('app');
    const leaf = body.model.classes.find((c) => c.name === 'Leaf');
    expect(leaf?.ancestors).toEqual(['Mid', 'Root']);
    expect(body.visibleClasses.sort()).toEqual(['Leaf', 'Mid']);
  });

  it('answers 422 on invalid input and 404 on an unknown template', async () => {
    const instance = await app();
    const bad = await instance.inject('/api/templates/bad');
    expect(bad.statusCode).toBe(422);
    expect(bad.json<{ message: string }>().message).toContain('duplicate property "a" (IV1)');
    expect((await instance.inject('/api/templates/none')).statusCode).toBe(404);
  });
});

describe('loadConfig', () => {
  it('resolves modelDir relative to the config file and applies defaults', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tc-viewer-config-'));
    try {
      writeFileSync(join(dir, 'server.config.json'), '{ "modelDir": "." }');
      expect(loadConfig(join(dir, 'server.config.json'))).toEqual({
        modelDir: resolve(dir),
        host: '127.0.0.1',
        port: 5180,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a missing template directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tc-viewer-config-'));
    try {
      writeFileSync(join(dir, 'server.config.json'), '{ "modelDir": "missing" }');
      expect(() => loadConfig(join(dir, 'server.config.json'))).toThrow(/does not exist/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Real data (gitignored): issuemgmt with its dependencies cm and foundation.
const ISSUEMGMT_DIR = resolve(PROJECT_ROOT, 'examples/issuemgmt');

describe.skipIf(!existsSync(ISSUEMGMT_DIR))('issuemgmt template', () => {
  it('builds the model from referenced artifacts only', { timeout: 120_000 }, async () => {
    const instance = await buildApp({ repository: await TemplateRepository.open(ISSUEMGMT_DIR) });

    const list = (await instance.inject('/api/templates')).json<TemplateInfo[]>();
    expect(list.map((t) => t.name)).toEqual(['cm', 'foundation', 'issuemgmt']);
    const info = list.find((t) => t.name === 'issuemgmt');
    expect(info?.displayName).toBe('Issue Management');
    expect(info?.includes).toEqual(['foundation_template.xml', 'cm_template.xml']);

    const started = performance.now();
    const response = await instance.inject('/api/templates/issuemgmt');
    const firstLoadMs = performance.now() - started;
    expect(response.statusCode).toBe(200);
    const { model, visibleClasses } = response.json<TemplateModelDto>();
    const classes = new Map(model.classes.map((c) => [c.name, c]));
    const visible = new Set(visibleClasses);

    // UI12: main classes and their direct parents are visible.
    expect(visible.has('IssueReportRevision')).toBe(true);
    expect(visible.has('ProblemReportRevision')).toBe(true);
    // The full ancestor chain is in the model, but not visible.
    expect(classes.get('IssueReportRevision')?.ancestors).toEqual([
      'ProblemReportRevision',
      'GnProblemReportRevision',
      'ChangeItemRevision',
      'ItemRevision',
      'WorkspaceObject',
      'POM_application_object',
      'POM_object',
    ]);
    expect(classes.has('ChangeItemRevision')).toBe(true);
    expect(visible.has('ChangeItemRevision')).toBe(false);
    expect(classes.get('ProblemReportRevision')?.template).toBe('cm');

    // UI7: relation classes derive from ImanRelation through IssueRelation.
    expect(classes.get('ImageAfterFix')?.ancestors).toContain('ImanRelation');
    expect(classes.get('ImageAfterFix')?.grmRules).toHaveLength(1);

    // TL3: unreferenced dependency classes are not selected.
    expect(classes.has('Dataset')).toBe(false);
    expect(classes.size).toBeLessThan(100);

    // TL5: a second request is served from the cache.
    const again = performance.now();
    await instance.inject('/api/templates/issuemgmt');
    const cachedMs = performance.now() - again;
    console.log(
      `issuemgmt: first load ${firstLoadMs.toFixed(0)} ms, cached ${cachedMs.toFixed(0)} ms, ` +
        `${classes.size} classes, ${visible.size} visible`,
    );
    expect(cachedMs).toBeLessThan(firstLoadMs);
  });
});
