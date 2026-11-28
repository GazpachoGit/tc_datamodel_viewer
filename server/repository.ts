import { createReadStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildModel } from '../src/model/builder';
import { modelToDto, type TemplateModelDto } from '../src/model/dto';
import {
  DEPENDENCY_SUFFIX,
  TEMPLATE_SUFFIX,
  parseDependencyXml,
  parseTcXmlStream,
} from '../src/model/parser';
import { selectArtifacts, visibleClassNames } from '../src/model/selection';
import { ModelError, type ParsedFile, type TemplateInfo } from '../src/model/types';

/**
 * Templates of one directory and the caches of the use case "Load a
 * template". Built once at server start; changes in the directory are
 * picked up after a restart.
 */
export class TemplateRepository {
  /** TL2: parse results by template file name, shared between templates. */
  private readonly parsedFiles = new Map<string, Promise<ParsedFile>>();
  /** TL5: built templates by template name. */
  private readonly templates = new Map<string, Promise<TemplateModelDto>>();

  readonly modelDir: string;
  private readonly infos: TemplateInfo[];
  private readonly templateFiles: Set<string>;

  private constructor(modelDir: string, infos: TemplateInfo[], templateFiles: Set<string>) {
    this.modelDir = modelDir;
    this.infos = infos;
    this.templateFiles = templateFiles;
  }

  /**
   * LT1: reads every `*_dependency.xml` directly in `modelDir` (IN2, IN3).
   * Only templates with a template file are listed. Throws ModelError on a
   * malformed dependency file (LT2).
   */
  static async open(modelDir: string): Promise<TemplateRepository> {
    const entries = await readdir(modelDir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    const templateFiles = new Set(files.filter((f) => f.endsWith(TEMPLATE_SUFFIX)));

    const infos: TemplateInfo[] = [];
    for (const file of files.filter((f) => f.endsWith(DEPENDENCY_SUFFIX))) {
      const info = parseDependencyXml(file, await readFile(join(modelDir, file), 'utf8'));
      if (templateFiles.has(info.templateFile)) {
        infos.push(info);
      }
    }
    infos.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return new TemplateRepository(modelDir, infos, templateFiles);
  }

  /** UI10: the templates, sorted by display name. */
  list(): TemplateInfo[] {
    return this.infos;
  }

  find(name: string): TemplateInfo | undefined {
    return this.infos.find((info) => info.name === name);
  }

  /**
   * TL1-TL5: builds the template's model from the main template and its
   * includes (one level), cached by name. A failed build is not cached.
   */
  loadTemplate(info: TemplateInfo): Promise<TemplateModelDto> {
    let result = this.templates.get(info.name);
    if (!result) {
      result = this.build(info);
      result.catch(() => this.templates.delete(info.name));
      this.templates.set(info.name, result);
    }
    return result;
  }

  private async build(info: TemplateInfo): Promise<TemplateModelDto> {
    const nameOf = (file: string) =>
      this.infos.find((t) => t.templateFile === file)?.name ?? file.slice(0, -TEMPLATE_SUFFIX.length);

    const [main, ...deps] = await Promise.all([
      this.parse(info.templateFile, info.name, info.dependencyFile),
      ...info.includes
        .filter((file) => file !== info.templateFile)
        .map((file) => this.parse(file, nameOf(file), info.dependencyFile)),
    ]);

    // TL3, TL4: main template first, then includes in order.
    const model = buildModel(selectArtifacts(main, deps));
    return {
      info,
      model: modelToDto(model),
      visibleClasses: Array.from(visibleClassNames(model, main)),
    };
  }

  /** TL2: streams and parses a template file once per server run. */
  private parse(file: string, template: string, referrer: string): Promise<ParsedFile> {
    let parsed = this.parsedFiles.get(file);
    if (!parsed) {
      if (!this.templateFiles.has(file)) {
        return Promise.reject(
          new ModelError(`${referrer}: template file "${file}" not found (TL1)`),
        );
      }
      const stream = createReadStream(join(this.modelDir, file), { encoding: 'utf8' });
      parsed = parseTcXmlStream(file, stream, template);
      parsed.catch(() => this.parsedFiles.delete(file));
      this.parsedFiles.set(file, parsed);
    }
    return parsed;
  }
}
