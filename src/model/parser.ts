import { SaxesParser, type SaxesTagNS } from 'saxes';
import {
  ModelError,
  type ParsedFile,
  type RawAttribute,
  type RawAttributeAttach,
  type RawClass,
  type RawLovDefinition,
  type TemplateInfo,
} from './types';

/** Teamcenter business model namespace (AC1). */
export const TC_NAMESPACE = 'http://teamcenter.com/BusinessModel/TcBusinessData';

/** Suffix of template dependency files (IN2). */
export const DEPENDENCY_SUFFIX = '_dependency.xml';

/** Suffix of template model files (IN2). */
export const TEMPLATE_SUFFIX = '_template.xml';

/**
 * Parses one Teamcenter XML file and extracts the elements the model is
 * built from, honoring the Teamcenter namespace. `template` names the
 * template the file belongs to (UI12).
 * Throws ModelError when the XML is not well-formed.
 */
export function parseTcXml(fileName: string, xmlText: string, template?: string): ParsedFile {
  const collector = new TcCollector(fileName, template);
  collector.write(xmlText);
  return collector.close();
}

/**
 * Streaming variant of parseTcXml: the file is consumed chunk by chunk, so
 * large templates are never held in memory as one string or as a DOM.
 */
export async function parseTcXmlStream(
  fileName: string,
  chunks: AsyncIterable<string>,
  template?: string,
): Promise<ParsedFile> {
  const collector = new TcCollector(fileName, template);
  for await (const chunk of chunks) {
    collector.write(chunk);
  }
  return collector.close();
}

/**
 * Parses a `<prefix>_dependency.xml` file (IN3, LT1): the template `name`,
 * `displayName` and `include/@file` list. The template file is
 * `<prefix>_template.xml`.
 * Throws ModelError when the file is malformed or has no `name` (LT2).
 */
export function parseDependencyXml(fileName: string, xmlText: string): TemplateInfo {
  let root: Element | undefined;
  let depth = 0;
  const includes: string[] = [];
  const parser = createParser(fileName);
  parser.on('opentag', (tag) => {
    depth++;
    if (depth === 1) {
      root = new Element(tag);
    } else if (depth === 2 && tag.local === 'include') {
      const file = new Element(tag).get('file');
      if (file) {
        includes.push(file);
      }
    }
  });
  parser.on('closetag', () => {
    depth--;
  });
  run(fileName, () => parser.write(xmlText).close());

  if (!root || root.local !== 'TcBusinessDataIncludes') {
    throw new ModelError(`${fileName}: root element is not <TcBusinessDataIncludes>`);
  }
  const name = root.require('name', fileName);
  const prefix = fileName.endsWith(DEPENDENCY_SUFFIX)
    ? fileName.slice(0, -DEPENDENCY_SUFFIX.length)
    : fileName;
  return {
    name,
    displayName: root.get('displayName') || name,
    dependencyFile: fileName,
    templateFile: prefix + TEMPLATE_SUFFIX,
    includes,
  };
}

/** What an open element is collecting into, for its direct children. */
type Frame =
  | { kind: 'none' }
  | { kind: 'attributes'; target: RawAttribute[] }
  | { kind: 'propertyContext'; element: Element }
  | { kind: 'lovAttach'; typeName: string; lovName: string }
  | { kind: 'lov'; definition: RawLovDefinition };

/**
 * SAX handler collecting the elements of ParsedFile. Top-level kinds
 * (TcClass, TcAttributeAttach, ...) are found at any depth, in document
 * order; nested kinds (TcAttribute, TcProperty, TcLOVAttachPropertyInfo,
 * TcLOVValue) are taken only as direct children of their parent element.
 */
class TcCollector {
  private readonly fileName: string;
  private readonly parser: SaxesParser<{ xmlns: true }>;
  private readonly stack: Frame[] = [];
  private readonly result: ParsedFile;

  constructor(fileName: string, template?: string) {
    this.fileName = fileName;
    this.result = {
      fileName,
      template,
      classes: [],
      attaches: [],
      compoundRules: [],
      relationProperties: [],
      grmRules: [],
      lovAttaches: [],
      lovDefinitions: [],
    };
    this.parser = createParser(fileName);
    this.parser.on('opentag', (tag) => this.stack.push(this.open(tag)));
    this.parser.on('closetag', () => this.stack.pop());
  }

  write(chunk: string): void {
    run(this.fileName, () => this.parser.write(chunk));
  }

  close(): ParsedFile {
    run(this.fileName, () => this.parser.close());
    return this.result;
  }

  private open(tag: SaxesTagNS): Frame {
    if (tag.uri !== TC_NAMESPACE) {
      return { kind: 'none' };
    }
    const el = new Element(tag);
    const parent = this.stack[this.stack.length - 1] ?? { kind: 'none' };
    const fileName = this.fileName;
    const r = this.result;

    switch (tag.local) {
      case 'TcClass': {
        const rawClass: RawClass = {
          className: el.require('className', fileName),
          parentClassName: el.get('parentClassName') ?? undefined,
          attributes: [],
        };
        r.classes.push(rawClass);
        return { kind: 'attributes', target: rawClass.attributes };
      }
      case 'TcAttributeAttach': {
        const attach: RawAttributeAttach = {
          className: el.require('className', fileName),
          attributes: [],
        };
        r.attaches.push(attach);
        return { kind: 'attributes', target: attach.attributes };
      }
      case 'TcAttribute':
        if (parent.kind === 'attributes') {
          parent.target.push({
            name: el.require('attributeName', fileName),
            attributeType: el.require('attributeType', fileName),
            xmlAttributes: el.all(),
          });
        }
        return { kind: 'none' };
      case 'TcCompoundPropertyRule':
        r.compoundRules.push({
          destTypeName: el.require('destTypeName', fileName),
          destPropertyName: el.require('destPropertyName', fileName),
          xmlAttributes: el.all(),
        });
        return { kind: 'none' };
      // NF9: relation TcProperty elements in TcStandardType and TcPropertyAttach.
      case 'TcStandardType':
      case 'TcPropertyAttach':
        return { kind: 'propertyContext', element: el };
      case 'TcProperty':
        if (parent.kind === 'propertyContext' && el.get('propTypeName') === 'Relation') {
          r.relationProperties.push({
            primaryTypeName: parent.element.require('typeName', fileName),
            propName: el.require('propName', fileName),
          });
        }
        return { kind: 'none' };
      // NF10: TcGRMRule elements.
      case 'TcGRMRule':
        r.grmRules.push({
          relationTypeName: el.require('relationTypeName', fileName),
          xmlAttributes: el.all(),
        });
        return { kind: 'none' };
      // NF11: TcLOVAttach with nested TcLOVAttachPropertyInfo, flattened.
      case 'TcLOVAttach':
        return {
          kind: 'lovAttach',
          lovName: el.require('lovName', fileName),
          typeName: el.require('typeName', fileName),
        };
      case 'TcLOVAttachPropertyInfo':
        if (parent.kind === 'lovAttach') {
          r.lovAttaches.push({
            typeName: parent.typeName,
            lovName: parent.lovName,
            valuePropertyName: el.require('valuePropertyName', fileName),
            conditionName: el.get('conditionName') ?? '',
          });
        }
        return { kind: 'none' };
      // NF11: TcLOV definitions with their TcLOVValue entries.
      case 'TcLOV': {
        const definition: RawLovDefinition = { name: el.require('name', fileName), values: [] };
        r.lovDefinitions.push(definition);
        return { kind: 'lov', definition };
      }
      case 'TcLOVValue':
        if (parent.kind === 'lov') {
          parent.definition.values.push({
            value: el.require('value', fileName),
            description: el.get('description') ?? '',
          });
        }
        return { kind: 'none' };
      default:
        return { kind: 'none' };
    }
  }
}

/** Attribute access for one start tag, keyed by qualified attribute name. */
class Element {
  readonly local: string;
  private readonly tag: SaxesTagNS;

  constructor(tag: SaxesTagNS) {
    this.tag = tag;
    this.local = tag.local;
  }

  get(name: string): string | null {
    return this.tag.attributes[name]?.value ?? null;
  }

  require(name: string, fileName: string): string {
    const value = this.get(name);
    if (value === null || value === '') {
      throw new ModelError(`${fileName}: <${this.local}> is missing the "${name}" attribute`);
    }
    return value;
  }

  /** All XML attributes, for flag and characteristic lookup. */
  all(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, attr] of Object.entries(this.tag.attributes)) {
      result[name] = attr.value;
    }
    return result;
  }
}

function createParser(fileName: string): SaxesParser<{ xmlns: true }> {
  const parser = new SaxesParser({ xmlns: true, fileName });
  parser.on('error', (error) => {
    throw new ModelError(`Failed to parse ${error.message}`);
  });
  return parser;
}

/** Runs a parser step; non-model errors become ModelError with the file name. */
function run(fileName: string, step: () => void): void {
  try {
    step();
  } catch (e) {
    if (e instanceof ModelError) {
      throw e;
    }
    throw new ModelError(`Failed to parse ${fileName}: ${(e as Error).message}`);
  }
}
