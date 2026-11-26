import {
  ModelError,
  type LovValue,
  type MappingConfig,
  type Model,
  type ParsedFile,
  type RawAttribute,
  type RawCompoundRule,
  type RawGrmRule,
  type UmlAttribute,
  type UmlClass,
} from './types';

/** Parent assigned to relation classes created by GRM rules (NF10, UI7). */
export const IMAN_RELATION = 'ImanRelation';

/**
 * Builds the intermediate model from parsed files (NF1-NF10), enforcing the
 * input validation rules (IV1-IV6):
 * - duplicate property names within a class (attributes and compound
 *   properties combined) abort with ModelError (IV1);
 * - two different non-empty parents for a class abort with ModelError (IV2);
 * - attributes with an attributeType missing from the mapping are silently
 *   skipped (IV3);
 * - duplicate primary-relation pair declarations abort with ModelError (IV5);
 * - duplicate GRM rule composite identifiers abort with ModelError (IV6);
 * - duplicate LOV attach composite identifiers abort with ModelError (IV7).
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
    // NF8: TcCompoundPropertyRule adds compound properties to the dest class.
    for (const rule of file.compoundRules) {
      const umlClass = getOrCreateClass(model, rule.destTypeName);
      addCompound(umlClass, rule, mapping, file.fileName);
    }
    // NF9: relation properties connect the primary class to a relation class.
    for (const rel of file.relationProperties) {
      const primary = getOrCreateClass(model, rel.primaryTypeName);
      getOrCreateClass(model, rel.propName);
      if (primary.relations.has(rel.propName)) {
        throw new ModelError(
          `${file.fileName}: class "${primary.name}" has a duplicate relation ` +
            `"${rel.propName}" (IV5)`,
        );
      }
      primary.relations.add(rel.propName);
    }
    // NF10: TcGRMRule appends GRM rules to its relation class.
    for (const rule of file.grmRules) {
      addGrmRule(model, rule, mapping, file.fileName);
    }
  }

  // NF11: after all classes and attributes are built, attach LOVs.
  attachLovs(model, files);

  // NF4: ensure referenced parents exist as classes.
  for (const umlClass of Array.from(model.classes.values())) {
    if (umlClass.parent && !model.classes.has(umlClass.parent)) {
      model.classes.set(umlClass.parent, {
        name: umlClass.parent,
        attributes: new Map(),
        compounds: new Map(),
        relations: new Set(),
        grmRules: [],
      });
    }
  }

  return model;
}

function getOrCreateClass(model: Model, name: string): UmlClass {
  let umlClass = model.classes.get(name);
  if (!umlClass) {
    umlClass = {
      name,
      attributes: new Map(),
      compounds: new Map(),
      relations: new Set(),
      grmRules: [],
    };
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
  requireUniqueName(umlClass, rawAttr.name, fileName);

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
    lovs: [],
  };
  umlClass.attributes.set(attribute.name, attribute);
}

/** NF8, IV1: maps and adds one compound property to a class. */
function addCompound(
  umlClass: UmlClass,
  rule: RawCompoundRule,
  mapping: MappingConfig,
  fileName: string,
): void {
  if (!mapping.compound) {
    return; // No compound mapping configured: rules are skipped.
  }
  requireUniqueName(umlClass, rule.destPropertyName, fileName);

  const chars: Record<string, string> = {};
  for (const charName of mapping.compound.chars) {
    const value = rule.xmlAttributes[charName];
    if (value !== undefined && value !== '') {
      chars[charName] = value; // AR2: omit missing or empty characteristics.
    }
  }

  umlClass.compounds.set(rule.destPropertyName, {
    name: rule.destPropertyName,
    type: mapping.compound.type,
    chars,
  });
}

/** IV1: property names are unique across attributes and compound properties. */
function requireUniqueName(umlClass: UmlClass, name: string, fileName: string): void {
  if (umlClass.attributes.has(name) || umlClass.compounds.has(name)) {
    throw new ModelError(
      `${fileName}: class "${umlClass.name}" has a duplicate property "${name}" (IV1)`,
    );
  }
}

/** NF10, IV6: appends one GRM rule to its relation class. */
function addGrmRule(
  model: Model,
  rule: RawGrmRule,
  mapping: MappingConfig,
  fileName: string,
): void {
  if (!mapping.grmRule) {
    return; // No GRM rule mapping configured: rules are skipped.
  }
  let umlClass = model.classes.get(rule.relationTypeName);
  if (!umlClass) {
    umlClass = {
      name: rule.relationTypeName,
      parent: IMAN_RELATION,
      attributes: new Map(),
      compounds: new Map(),
      relations: new Set(),
      grmRules: [],
    };
    model.classes.set(umlClass.name, umlClass);
  }

  // IV6: composite identifier primaryTypeName + secondaryTypeName + conditionName.
  const ID_PARTS = ['primaryTypeName', 'secondaryTypeName', 'conditionName'];
  const keyOf = (get: (name: string) => string | undefined) =>
    ID_PARTS.map((part) => get(part) ?? '').join('\u0000');
  const key = keyOf((part) => rule.xmlAttributes[part]);
  if (umlClass.grmRules.some((existing) => keyOf((part) => existing.chars[part]) === key)) {
    const id = ID_PARTS.map((part) => `${part} "${rule.xmlAttributes[part] ?? ''}"`).join(', ');
    throw new ModelError(
      `${fileName}: relation class "${umlClass.name}" has a duplicate GRM rule (${id}) (IV6)`,
    );
  }

  const chars: Record<string, string> = {};
  for (const charName of mapping.grmRule.chars) {
    const value = rule.xmlAttributes[charName];
    if (value !== undefined && value !== '') {
      chars[charName] = value; // AR3: omit missing or empty characteristics.
    }
  }
  umlClass.grmRules.push({ chars });
}

/** NF11, IV7: attaches LOV records to built attributes. */
function attachLovs(model: Model, files: ParsedFile[]): void {
  // First TcLOV definition per name wins, in file load order.
  const definitions = new Map<string, LovValue[]>();
  for (const file of files) {
    for (const definition of file.lovDefinitions) {
      if (!definitions.has(definition.name)) {
        definitions.set(definition.name, definition.values);
      }
    }
  }

  for (const file of files) {
    for (const attach of file.lovAttaches) {
      const attribute = model.classes
        .get(attach.typeName)
        ?.attributes.get(attach.valuePropertyName);
      if (!attribute) {
        continue; // NF11: unknown class or attribute, skip silently.
      }
      if (
        attribute.lovs.some(
          (lov) => lov.name === attach.lovName && lov.condition === attach.conditionName,
        )
      ) {
        throw new ModelError(
          `${file.fileName}: attribute "${attach.typeName}.${attach.valuePropertyName}" has ` +
            `a duplicate LOV attach (lovName "${attach.lovName}", ` +
            `conditionName "${attach.conditionName}") (IV7)`,
        );
      }
      attribute.lovs.push({
        name: attach.lovName,
        condition: attach.conditionName,
        values: definitions.get(attach.lovName),
      });
    }
  }
}
