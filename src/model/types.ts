/**
 * Intermediate data model (spec/model.md, DM1-DM2) and related types.
 */

/** One value of an LOV definition, from TcLOVValue (NF11). */
export interface LovValue {
  value: string;
  /** Description; empty is displayed as `NA` (AR4). */
  description: string;
}

/** One LOV attachment of an attribute, from TcLOVAttach (NF11). */
export interface AttributeLov {
  /** LOV name from `lovName`. */
  name: string;
  /** Condition from `conditionName`. */
  condition: string;
  /**
   * Values of the first matching TcLOV definition, in input order.
   * Undefined when no definition was found (AR4 shows a message).
   */
  values?: LovValue[];
}

/** One attribute of a UML class (DM2). */
export interface UmlAttribute {
  /** Attribute name from `attributeName`. */
  name: string;
  /** Display type converted from `attributeType` (spec/mapping.md). */
  type: string;
  /** Whether the attribute is an array (adds `[]` in the diagram). */
  isArray: boolean;
  /** Original XML name of the array flag attribute (`isArray`). */
  arrayFlagName: string;
  /** Raw XML value of the array flag attribute, if present. */
  arrayFlagValue?: string;
  /**
   * Characteristics for the attribute type (spec/mapping.md), keyed by their
   * original XML names. Missing or empty values are omitted (AR1).
   */
  chars: Record<string, string>;
  /** LOV attachments of this attribute, in input order (NF11). */
  lovs: AttributeLov[];
}

/** One compound property of a UML class, from TcCompoundPropertyRule (NF8). */
export interface UmlCompound {
  /** Property name from `destPropertyName`. */
  name: string;
  /** Display type, always `Compound` (spec/mapping.md). */
  type: string;
  /**
   * Characteristics from spec/mapping.md, keyed by their original XML
   * names. Missing or empty values are omitted (AR2).
   */
  chars: Record<string, string>;
}

/** One GRM rule of a relation class, from TcGRMRule (NF10). */
export interface GrmRule {
  /**
   * Characteristics from spec/mapping.md, keyed by their original XML
   * names. Missing or empty values are omitted (AR3).
   */
  chars: Record<string, string>;
}

/** One UML class (DM2). */
export interface UmlClass {
  name: string;
  /** Parent class name; undefined when the class has no parent. */
  parent?: string;
  /** Attributes keyed by name, in insertion order. */
  attributes: Map<string, UmlAttribute>;
  /** Compound properties keyed by name, in insertion order. */
  compounds: Map<string, UmlCompound>;
  /**
   * Names of relation classes owned by this class as primary (NF9). The
   * relation property name always equals the relation class name and refers
   * to a regular class in `Model.classes`.
   */
  relations: Set<string>;
  /** GRM rules of this relation class, in input order (NF10). */
  grmRules: GrmRule[];
}

/** The merged model built from all input files (DM2). */
export interface Model {
  /** Classes keyed by name, in insertion order. */
  classes: Map<string, UmlClass>;
}

/** A TcAttribute as read from XML, before conversion. */
export interface RawAttribute {
  name: string;
  attributeType: string;
  /** All XML attributes of the element, for flag and characteristic lookup. */
  xmlAttributes: Record<string, string>;
}

/** A TcClass as read from XML. */
export interface RawClass {
  className: string;
  parentClassName?: string;
  attributes: RawAttribute[];
}

/** A TcAttributeAttach as read from XML. */
export interface RawAttributeAttach {
  className: string;
  attributes: RawAttribute[];
}

/** A TcCompoundPropertyRule as read from XML. */
export interface RawCompoundRule {
  destTypeName: string;
  destPropertyName: string;
  /** All XML attributes of the element, for characteristic lookup. */
  xmlAttributes: Record<string, string>;
}

/** A relation TcProperty found in a TcStandardType or TcPropertyAttach (NF9). */
export interface RawRelationProperty {
  /** `typeName` of the enclosing element: the primary class. */
  primaryTypeName: string;
  /** `propName` of the property: the relation class name. */
  propName: string;
}

/** A TcGRMRule as read from XML (NF10). */
export interface RawGrmRule {
  /** `relationTypeName`: the relation class the rule belongs to. */
  relationTypeName: string;
  /** All XML attributes of the element, for characteristic lookup. */
  xmlAttributes: Record<string, string>;
}

/** One TcLOVAttachPropertyInfo within a TcLOVAttach, flattened (NF11). */
export interface RawLovAttach {
  /** `typeName` of the TcLOVAttach: the class to look up. */
  typeName: string;
  /** `lovName` of the TcLOVAttach. */
  lovName: string;
  /** `valuePropertyName` of the info: the attribute to look up. */
  valuePropertyName: string;
  /** `conditionName` of the info. */
  conditionName: string;
}

/** A TcLOV definition (NF11). */
export interface RawLovDefinition {
  name: string;
  values: LovValue[];
}

/** Relevant content of one parsed XML file. */
export interface ParsedFile {
  /** File name, used in error messages. */
  fileName: string;
  classes: RawClass[];
  attaches: RawAttributeAttach[];
  compoundRules: RawCompoundRule[];
  relationProperties: RawRelationProperty[];
  grmRules: RawGrmRule[];
  lovAttaches: RawLovAttach[];
  lovDefinitions: RawLovDefinition[];
}

/** Invalid input (IV1, IV2) or malformed file detected while building the model. */
export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelError';
  }
}
