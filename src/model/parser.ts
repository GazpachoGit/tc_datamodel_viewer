import {
  ModelError,
  type ParsedFile,
  type RawAttribute,
  type RawAttributeAttach,
  type RawClass,
  type RawCompoundRule,
  type RawGrmRule,
  type RawRelationProperty,
} from './types';

/** Teamcenter business model namespace (AC1). */
export const TC_NAMESPACE = 'http://teamcenter.com/BusinessModel/TcBusinessData';

/**
 * Parses one Teamcenter XML file and extracts TcClass, TcAttribute and
 * TcAttributeAttach elements, honoring the Teamcenter namespace.
 * Throws ModelError when the XML is not well-formed.
 */
export function parseTcXml(fileName: string, xmlText: string): ParsedFile {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new ModelError(
      `Failed to parse ${fileName}: ${parseError.textContent?.trim() ?? 'XML parse error'}`,
    );
  }

  const classes: RawClass[] = [];
  for (const el of byTag(doc, 'TcClass')) {
    const className = requireAttr(el, 'className', fileName);
    classes.push({
      className,
      parentClassName: el.getAttribute('parentClassName') ?? undefined,
      attributes: childAttributes(el, fileName),
    });
  }

  const attaches: RawAttributeAttach[] = [];
  for (const el of byTag(doc, 'TcAttributeAttach')) {
    const className = requireAttr(el, 'className', fileName);
    attaches.push({ className, attributes: childAttributes(el, fileName) });
  }

  const compoundRules: RawCompoundRule[] = [];
  for (const el of byTag(doc, 'TcCompoundPropertyRule')) {
    const xmlAttributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      xmlAttributes[attr.name] = attr.value;
    }
    compoundRules.push({
      destTypeName: requireAttr(el, 'destTypeName', fileName),
      destPropertyName: requireAttr(el, 'destPropertyName', fileName),
      xmlAttributes,
    });
  }

  // NF9: relation TcProperty elements in TcStandardType and TcPropertyAttach.
  const relationProperties: RawRelationProperty[] = [];
  for (const contextName of ['TcStandardType', 'TcPropertyAttach']) {
    for (const el of byTag(doc, contextName)) {
      for (const child of Array.from(el.children)) {
        if (
          child.namespaceURI === TC_NAMESPACE &&
          child.localName === 'TcProperty' &&
          child.getAttribute('propTypeName') === 'Relation'
        ) {
          relationProperties.push({
            primaryTypeName: requireAttr(el, 'typeName', fileName),
            propName: requireAttr(child, 'propName', fileName),
          });
        }
      }
    }
  }

  // NF10: TcGRMRule elements.
  const grmRules: RawGrmRule[] = [];
  for (const el of byTag(doc, 'TcGRMRule')) {
    const xmlAttributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      xmlAttributes[attr.name] = attr.value;
    }
    grmRules.push({
      relationTypeName: requireAttr(el, 'relationTypeName', fileName),
      xmlAttributes,
    });
  }

  return { fileName, classes, attaches, compoundRules, relationProperties, grmRules };
}

function byTag(doc: Document, localName: string): Element[] {
  return Array.from(doc.getElementsByTagNameNS(TC_NAMESPACE, localName));
}

function childAttributes(parent: Element, fileName: string): RawAttribute[] {
  const result: RawAttribute[] = [];
  for (const child of Array.from(parent.children)) {
    if (child.namespaceURI !== TC_NAMESPACE || child.localName !== 'TcAttribute') {
      continue;
    }
    const xmlAttributes: Record<string, string> = {};
    for (const attr of Array.from(child.attributes)) {
      xmlAttributes[attr.name] = attr.value;
    }
    result.push({
      name: requireAttr(child, 'attributeName', fileName),
      attributeType: requireAttr(child, 'attributeType', fileName),
      xmlAttributes,
    });
  }
  return result;
}

function requireAttr(el: Element, name: string, fileName: string): string {
  const value = el.getAttribute(name);
  if (value === null || value === '') {
    throw new ModelError(`${fileName}: <${el.localName}> is missing the "${name}" attribute`);
  }
  return value;
}
