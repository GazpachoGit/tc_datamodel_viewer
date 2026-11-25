import {
  ModelError,
  type MappingConfig,
  type Model,
  type ParsedFile,
  type RawAttribute,
  type UmlAttribute,
  type UmlClass,
} from './types';

/**
 * Builds the intermediate model from parsed files (NF1-NF7), enforcing the
 * input validation rules (IV1-IV4):
 * - duplicate attribute names within a class abort with ModelError (IV1);
 * - two different non-empty parents for a class abort with ModelError (IV2);
 * - attributes with an attributeType missing from the mapping are silently
 *   skipped (IV3).
 */
export function buildModel(files: ParsedFile[], mapping: MappingConfig): Model {
  const model: Model = { classes: new Map() };

  for (const file of files) {
    // NF2, NF3: one UML class per className, merged across definitions.
    for (const rawClass of file.classes) {
      const umlClass = getOrCreateClass(model, rawClass.className);
      setParent(umlClass, rawClass.parentClassName, file.fileName);
      for (const rawAttr of rawClass.attributes) {
        addAttribute(umlClass, rawAttr, mapping, file.fileName);
      }
    }
    // NF7: TcAttributeAttach adds attributes to an existing or new class.
    for (const attach of file.attaches) {
      const umlClass = getOrCreateClass(model, attach.className);
      for (const rawAttr of attach.attributes) {
        addAttribute(umlClass, rawAttr, mapping, file.fileName);
      }
    }
  }

  // NF4: ensure referenced parents exist as classes.
  for (const umlClass of Array.from(model.classes.values())) {
    if (umlClass.parent && !model.classes.has(umlClass.parent)) {
      model.classes.set(umlClass.parent, {
        name: umlClass.parent,
        attributes: new Map(),
      });
    }
  }

  return model;
}

function getOrCreateClass(model: Model, name: string): UmlClass {
  let umlClass = model.classes.get(name);
  if (!umlClass) {
    umlClass = { name, attributes: new Map() };
    model.classes.set(name, umlClass);
  }
  return umlClass;
}

/** NF4, NF5, IV2: sets the parent, creating it on first use. */
function setParent(umlClass: UmlClass, parentName: string | undefined, fileName: string): void {
  if (!parentName) {
    return; // NF5: absent or empty parent creates no relation and no conflict.
  }
  if (umlClass.parent !== undefined && umlClass.parent !== parentName) {
    throw new ModelError(
      `${fileName}: class "${umlClass.name}" has conflicting parents ` +
        `"${umlClass.parent}" and "${parentName}" (IV2)`,
    );
  }
  umlClass.parent = parentName;
}

/** NF6, IV1, IV3: maps and adds one attribute to a class. */
function addAttribute(
  umlClass: UmlClass,
  rawAttr: RawAttribute,
  mapping: MappingConfig,
  fileName: string,
): void {
  const typeMapping = mapping.types.get(rawAttr.attributeType);
  if (!typeMapping) {
    return; // IV3: unknown attribute types are silently ignored.
  }
  if (umlClass.attributes.has(rawAttr.name)) {
    throw new ModelError(
      `${fileName}: class "${umlClass.name}" has a duplicate attribute "${rawAttr.name}" (IV1)`,
    );
  }

  const arrayFlagValue = rawAttr.xmlAttributes[typeMapping.arrayFlag];
  const chars: Record<string, string> = {};
  for (const charName of typeMapping.chars) {
    const value = rawAttr.xmlAttributes[charName];
    if (value !== undefined && value !== '') {
      chars[charName] = value; // AR1: omit missing or empty characteristics.
    }
  }

  const attribute: UmlAttribute = {
    name: rawAttr.name,
    type: typeMapping.type,
    isArray: arrayFlagValue === 'true',
    arrayFlagName: typeMapping.arrayFlag,
    arrayFlagValue,
    chars,
  };
  umlClass.attributes.set(attribute.name, attribute);
}
