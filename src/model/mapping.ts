import { load } from 'js-yaml';
import {
  ModelError,
  type AttributeTypeMapping,
  type CompoundMapping,
  type GrmRuleMapping,
  type MappingConfig,
} from './types';

/**
 * Parses mapping.yaml content (AC2) and validates its structure.
 * Throws ModelError when the mapping file itself is malformed.
 */
export function parseMapping(yamlText: string): MappingConfig {
  let doc: unknown;
  try {
    doc = load(yamlText);
  } catch (e) {
    throw new ModelError(`Failed to parse mapping.yaml: ${(e as Error).message}`);
  }

  const root = asRecord(doc, 'mapping root');
  const tcAttribute = asRecord(root['TcAttribute'], 'TcAttribute');
  const typesNode = asRecord(tcAttribute['types'], 'TcAttribute.types');

  const types = new Map<string, AttributeTypeMapping>();
  for (const [typeName, value] of Object.entries(typesNode)) {
    const entry = asRecord(value, `type "${typeName}"`);
    const type = entry['type'];
    const arrayFlag = entry['array_flag'];
    if (typeof type !== 'string' || type === '') {
      throw new ModelError(`mapping.yaml: type "${typeName}" has no "type" value`);
    }
    if (typeof arrayFlag !== 'string' || arrayFlag === '') {
      throw new ModelError(`mapping.yaml: type "${typeName}" has no "array_flag" value`);
    }
    const charsNode = entry['chars'] ?? [];
    if (!Array.isArray(charsNode) || charsNode.some((c) => typeof c !== 'string')) {
      throw new ModelError(`mapping.yaml: type "${typeName}" has an invalid "chars" list`);
    }
    types.set(typeName, { type, arrayFlag, chars: charsNode as string[] });
  }
  return { types, compound: parseCompoundMapping(root), grmRule: parseGrmRuleMapping(root) };
}

function parseCompoundMapping(root: Record<string, unknown>): CompoundMapping | undefined {
  if (!('TcCompoundPropertyRule' in root)) {
    return undefined;
  }
  const entry = asRecord(root['TcCompoundPropertyRule'], 'TcCompoundPropertyRule');
  const type = entry['type'];
  if (typeof type !== 'string' || type === '') {
    throw new ModelError('mapping.yaml: TcCompoundPropertyRule has no "type" value');
  }
  const charsNode = entry['chars'] ?? [];
  if (!Array.isArray(charsNode) || charsNode.some((c) => typeof c !== 'string')) {
    throw new ModelError('mapping.yaml: TcCompoundPropertyRule has an invalid "chars" list');
  }
  return { type, chars: charsNode as string[] };
}

function parseGrmRuleMapping(root: Record<string, unknown>): GrmRuleMapping | undefined {
  if (!('TcGRMRule' in root)) {
    return undefined;
  }
  const entry = asRecord(root['TcGRMRule'], 'TcGRMRule');
  const charsNode = entry['chars'] ?? [];
  if (!Array.isArray(charsNode) || charsNode.some((c) => typeof c !== 'string')) {
    throw new ModelError('mapping.yaml: TcGRMRule has an invalid "chars" list');
  }
  return { chars: charsNode as string[] };
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ModelError(`mapping.yaml: ${what} is not a mapping`);
  }
  return value as Record<string, unknown>;
}
