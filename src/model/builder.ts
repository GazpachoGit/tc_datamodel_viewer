import {
  ModelError,
  type LovValue,
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

/** `parentClassName` value that means "no parent" (NF5). */
export const NO_PARENT = 'NULL';

/** XML attribute holding the array flag of a TcAttribute (spec/mapping.md). */
const ARRAY_FLAG = 'isArray';

/**
 * Display type and characteristics per TcAttribute `attributeType`
 * (spec/mapping.md, "Типы атрибутов"). Types not listed are skipped (IV3).
 */
const ATTRIBUTE_TYPES: Record<string, { type: string; chars: string[] }> = {
  POM_string: { type: 'String', chars: ['maxStringLength'] },
  POM_date: { type: 'Date', chars: [] },
  POM_int: { type: 'Integer', chars: ['lowerBoundValue', 'upperBoundValue'] },
  POM_double: { type: 'Double', chars: ['lowerBoundValue', 'upperBoundValue'] },
  POM_logical: { type: 'Boolean', chars: [] },
  POM_long_string: { type: 'LongString', chars: [] },
  POM_typed_reference: { type: 'TypedReference', chars: ['typedRefClassName'] },
  POM_untyped_reference: { type: 'UntypedReference', chars: [] },
};

/** Display type of compound properties (spec/mapping.md, "Compound"). */
const COMPOUND_TYPE = 'Compound';

/** Characteristics of compound properties (spec/mapping.md, "Compound"). */
const COMPOUND_CHARS = ['pathToSource'];

/** Characteristics of GRM rules (spec/mapping.md, "GRMRule"). */
const GRM_RULE_CHARS = [
  'primaryTypeName',
  'secondaryTypeName',
  'conditionName',
  'primaryCardinality',
  'secondaryCardinality',
];

/** Composite identifier of a GRM rule within its relation class (IV6). */
const GRM_RULE_ID = ['primaryTypeName', 'secondaryTypeName', 'conditionName'];

/** IV6: composite identifier of a GRM rule, from its raw XML values. */
export function grmRuleKey(rule: RawGrmRule): string {
  return GRM_RULE_ID.map((part) => rule.xmlAttributes[part] ?? '').join('\u0000');
}

/**
 * Builds the intermediate model from parsed files (NF1-NF11), converting XML
 * as described in spec/mapping.md and enforcing the input validation rules:
 * - duplicate property names within a class (attributes and compound
 *   properties combined) abort with ModelError (IV1);
 * - two different non-empty parents for a class abort with ModelError (IV2);
 * - attributes with an unknown attributeType are silently skipped (IV3);
 * - duplicate primary-relation pair declarations abort with ModelError (IV5);
 * - duplicate GRM rule composite identifiers abort with ModelError (IV6);
 * - duplicate LOV attach composite identifiers abort with ModelError (IV7);
 * - inheritance cycles abort with ModelError (IV8).
 */
export function buildModel(files: ParsedFile[]): Model {
  const model: Model = { template: files[0]?.template, classes: new Map() };
  // IV6: composite identifiers of GRM rules seen per relation class.
  const grmRuleIds = new Map<string, Set<string>>();

  for (const file of files) {
    // NF2, NF3: one UML class per className, merged across definitions.
    for (const rawClass of file.classes) {
      const umlClass = getOrCreateClass(model, rawClass.className);
      umlClass.template ??= file.template;
      setParent(umlClass, rawClass.parentClassName, file.fileName);
      for (const rawAttr of rawClass.attributes) {
        addAttribute(umlClass, rawAttr, file);
      }
    }
    // NF7: TcAttributeAttach adds attributes to an existing or new class.
    for (const attach of file.attaches) {
      const umlClass = getOrCreateClass(model, attach.className);
      for (const rawAttr of attach.attributes) {
        addAttribute(umlClass, rawAttr, file);
      }
    }
    // NF8: TcCompoundPropertyRule adds compound properties to the dest class.
    for (const rule of file.compoundRules) {
      const umlClass = getOrCreateClass(model, rule.destTypeName);
      addCompound(umlClass, rule, file);
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
      addGrmRule(model, grmRuleIds, rule, file);
    }
  }

  // NF11: after all classes and attributes are built, attach LOVs.
  attachLovs(model, files);

  // NF10: a relation class known only from GRM rules gets ImanRelation as
  // parent. This is a fallback applied after all files, so a TcClass
  // declaring another parent in a later file does not conflict (IV2).
  for (const umlClass of model.classes.values()) {
    const declared = umlClass.template !== undefined;
    if (umlClass.grmRules.length > 0 && umlClass.parent === undefined && !declared) {
      umlClass.parent = IMAN_RELATION;
    }
  }

  // NF4: ensure referenced parents exist as classes.
  for (const umlClass of Array.from(model.classes.values())) {
    if (umlClass.parent) {
      getOrCreateClass(model, umlClass.parent);
    }
  }

  // NF12, IV8: ancestors of every class, nearest first.
  for (const umlClass of model.classes.values()) {
    umlClass.ancestors = computeAncestors(model, umlClass);
  }

  return model;
}

function getOrCreateClass(model: Model, name: string): UmlClass {
  let umlClass = model.classes.get(name);
  if (!umlClass) {
    umlClass = {
      name,
      ancestors: [],
      attributes: new Map(),
      compounds: new Map(),
      relations: new Set(),
      grmRules: [],
    };
    model.classes.set(name, umlClass);
  }
  return umlClass;
}

/** NF12, IV8: walks the parent chain from the direct parent to the root. */
function computeAncestors(model: Model, umlClass: UmlClass): string[] {
  const ancestors: string[] = [];
  let parent = umlClass.parent;
  while (parent !== undefined) {
    if (parent === umlClass.name || ancestors.includes(parent)) {
      const cycle = [umlClass.name, ...ancestors, parent].join(' -> ');
      throw new ModelError(`class "${umlClass.name}" has an inheritance cycle (${cycle}) (IV8)`);
    }
    ancestors.push(parent);
    parent = model.classes.get(parent)?.parent;
  }
  return ancestors;
}

/** NF4, NF5, IV2: sets the parent, creating it on first use. */
function setParent(umlClass: UmlClass, parentName: string | undefined, fileName: string): void {
  if (!parentName || parentName === NO_PARENT) {
    return; // NF5: absent, empty or NULL parent creates no relation and no conflict.
  }
  if (umlClass.parent !== undefined && umlClass.parent !== parentName) {
    throw new ModelError(
      `${fileName}: class "${umlClass.name}" has conflicting parents ` +
        `"${umlClass.parent}" and "${parentName}" (IV2)`,
    );
  }
  umlClass.parent = parentName;
}

/** NF6, IV1, IV3: converts and adds one attribute to a class. */
function addAttribute(umlClass: UmlClass, rawAttr: RawAttribute, file: ParsedFile): void {
  const typeMapping = ATTRIBUTE_TYPES[rawAttr.attributeType];
  if (!typeMapping) {
    return; // IV3: unknown attribute types are silently ignored.
  }
  requireUniqueName(umlClass, rawAttr.name, file.fileName);

  const arrayFlagValue = rawAttr.xmlAttributes[ARRAY_FLAG];
  const attribute: UmlAttribute = {
    name: rawAttr.name,
    template: file.template,
    type: typeMapping.type,
    isArray: arrayFlagValue === 'true',
    arrayFlagName: ARRAY_FLAG,
    arrayFlagValue,
    chars: pickChars(rawAttr.xmlAttributes, typeMapping.chars),
    lovs: [],
  };
  umlClass.attributes.set(attribute.name, attribute);
}

/** NF8, IV1: converts and adds one compound property to a class. */
function addCompound(umlClass: UmlClass, rule: RawCompoundRule, file: ParsedFile): void {
  requireUniqueName(umlClass, rule.destPropertyName, file.fileName);
  umlClass.compounds.set(rule.destPropertyName, {
    name: rule.destPropertyName,
    template: file.template,
    type: COMPOUND_TYPE,
    chars: pickChars(rule.xmlAttributes, COMPOUND_CHARS),
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
  grmRuleIds: Map<string, Set<string>>,
  rule: RawGrmRule,
  file: ParsedFile,
): void {
  // NF10: the ImanRelation fallback parent is assigned after all files.
  const umlClass = getOrCreateClass(model, rule.relationTypeName);

  // IV6: the identifier comes from the raw XML values, independent of chars.
  const key = grmRuleKey(rule);
  let seen = grmRuleIds.get(umlClass.name);
  if (!seen) {
    seen = new Set();
    grmRuleIds.set(umlClass.name, seen);
  }
  if (seen.has(key)) {
    const id = GRM_RULE_ID.map((part) => `${part} "${rule.xmlAttributes[part] ?? ''}"`).join(', ');
    throw new ModelError(
      `${file.fileName}: relation class "${umlClass.name}" has a duplicate GRM rule (${id}) (IV6)`,
    );
  }
  seen.add(key);

  umlClass.grmRules.push({
    template: file.template,
    chars: pickChars(rule.xmlAttributes, GRM_RULE_CHARS),
  });
}

/**
 * Copies the listed XML attributes in list order, omitting missing or empty
 * values (AR1-AR3).
 */
function pickChars(xmlAttributes: Record<string, string>, names: string[]): Record<string, string> {
  const chars: Record<string, string> = {};
  for (const name of names) {
    const value = xmlAttributes[name];
    if (value !== undefined && value !== '') {
      chars[name] = value;
    }
  }
  return chars;
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
        template: file.template,
        condition: attach.conditionName,
        values: definitions.get(attach.lovName),
      });
    }
  }
}
