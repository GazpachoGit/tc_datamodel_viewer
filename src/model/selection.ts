import { NO_PARENT, grmRuleKey } from './builder';
import type {
  Model,
  ParsedFile,
  RawAttributeAttach,
  RawClass,
  RawCompoundRule,
  RawGrmRule,
  RawLovAttach,
} from './types';

/** Artifacts of one dependency file about one class (TL3). */
interface ClassArtifacts {
  classes: RawClass[];
  attaches: RawAttributeAttach[];
  compoundRules: RawCompoundRule[];
  grmRules: RawGrmRule[];
  lovAttaches: RawLovAttach[];
}

/**
 * TL3: selects the artifacts to build the main template's model from.
 *
 * All artifacts of `main` are kept. From each dependency file, only the
 * artifacts about classes referenced by the main template are kept, and the
 * parents of those classes are followed up to the root. TcLOV definitions
 * are kept when a selected LOV attachment names them. Relation properties
 * (NF9) of dependencies are never selected.
 *
 * TL3a: the main template takes precedence. A dependency artifact that the
 * main template also defines — a property of the same class (IV1), the
 * parent of a class the main template declares with a parent (IV2), a GRM
 * rule with the same identifier (IV6), or an LOV attachment with the same
 * identifier (IV7) — is dropped, so it neither conflicts nor overrides.
 *
 * Returns the main file followed by the filtered dependency files, in the
 * given order (TL4).
 */
export function selectArtifacts(main: ParsedFile, deps: ParsedFile[]): ParsedFile[] {
  const indexes = deps.map(indexByClass);
  const own = mainDefinitions(main);

  const selected = new Set<string>();
  const queue = Array.from(referencedClasses(main));
  const lovNames = new Set(main.lovAttaches.map((attach) => attach.lovName));
  const picked = deps.map(() => emptyArtifacts());

  while (queue.length > 0) {
    const className = queue.shift() as string;
    if (selected.has(className)) {
      continue;
    }
    selected.add(className);
    indexes.forEach((index, i) => {
      const artifacts = index.get(className);
      if (!artifacts) {
        return;
      }
      const target = picked[i];
      const kept = withoutMainDefinitions(artifacts, className, own);
      target.classes.push(...kept.classes);
      target.attaches.push(...kept.attaches);
      target.compoundRules.push(...kept.compoundRules);
      target.grmRules.push(...kept.grmRules);
      target.lovAttaches.push(...kept.lovAttaches);
      for (const rawClass of kept.classes) {
        const parent = rawClass.parentClassName;
        if (parent && parent !== NO_PARENT && !selected.has(parent)) {
          queue.push(parent);
        }
      }
      for (const attach of kept.lovAttaches) {
        lovNames.add(attach.lovName);
      }
    });
  }

  const filtered = deps.map((dep, i) => ({
    fileName: dep.fileName,
    template: dep.template,
    ...picked[i],
    relationProperties: [],
    lovDefinitions: dep.lovDefinitions.filter((definition) => lovNames.has(definition.name)),
  }));
  return [main, ...filtered];
}

/**
 * UI12: names of the classes rendered for the main template: classes it
 * declares or extends, their direct parents, and its relation classes.
 */
export function visibleClassNames(model: Model, main: ParsedFile): Set<string> {
  const touched = new Set<string>([
    ...main.classes.map((c) => c.className),
    ...main.attaches.map((a) => a.className),
    ...main.compoundRules.map((r) => r.destTypeName),
    ...main.relationProperties.flatMap((r) => [r.primaryTypeName, r.propName]),
    ...main.grmRules.map((r) => r.relationTypeName),
    ...main.lovAttaches.map((a) => a.typeName),
  ]);

  const visible = new Set<string>();
  for (const name of touched) {
    const umlClass = model.classes.get(name);
    if (!umlClass) {
      continue;
    }
    visible.add(name);
    if (umlClass.parent) {
      visible.add(umlClass.parent);
    }
  }
  return visible;
}

/** Class names the main template refers to (TL3). */
function referencedClasses(main: ParsedFile): Set<string> {
  const names = new Set<string>();
  for (const rawClass of main.classes) {
    names.add(rawClass.className);
    if (rawClass.parentClassName && rawClass.parentClassName !== NO_PARENT) {
      names.add(rawClass.parentClassName);
    }
  }
  main.attaches.forEach((a) => names.add(a.className));
  main.compoundRules.forEach((r) => names.add(r.destTypeName));
  main.relationProperties.forEach((r) => {
    names.add(r.primaryTypeName);
    names.add(r.propName);
  });
  main.grmRules.forEach((r) => names.add(r.relationTypeName));
  main.lovAttaches.forEach((a) => names.add(a.typeName));
  return names;
}

/** What the main template defines itself, for its precedence (TL3a). */
interface MainDefinitions {
  /** Property names (attributes and compound properties) per class. */
  properties: Map<string, Set<string>>;
  /** Classes the main template declares with a parent. */
  parents: Set<string>;
  /** GRM rule identifiers per relation class. */
  grmRules: Map<string, Set<string>>;
  /** LOV attachment identifiers: class, attribute, lovName, conditionName. */
  lovAttaches: Set<string>;
}

function mainDefinitions(main: ParsedFile): MainDefinitions {
  const properties = new Map<string, Set<string>>();
  const addProperty = (className: string, name: string) => {
    let names = properties.get(className);
    if (!names) {
      names = new Set();
      properties.set(className, names);
    }
    names.add(name);
  };
  for (const rawClass of [...main.classes, ...main.attaches]) {
    rawClass.attributes.forEach((a) => addProperty(rawClass.className, a.name));
  }
  main.compoundRules.forEach((r) => addProperty(r.destTypeName, r.destPropertyName));

  const parents = new Set(
    main.classes
      .filter((c) => c.parentClassName && c.parentClassName !== NO_PARENT)
      .map((c) => c.className),
  );

  const grmRules = new Map<string, Set<string>>();
  for (const rule of main.grmRules) {
    let keys = grmRules.get(rule.relationTypeName);
    if (!keys) {
      keys = new Set();
      grmRules.set(rule.relationTypeName, keys);
    }
    keys.add(grmRuleKey(rule));
  }

  return {
    properties,
    parents,
    grmRules,
    lovAttaches: new Set(main.lovAttaches.map(lovAttachKey)),
  };
}

/** TL3a: copies the artifacts of one class without what the main template defines. */
function withoutMainDefinitions(
  artifacts: ClassArtifacts,
  className: string,
  own: MainDefinitions,
): ClassArtifacts {
  const ownProperties = own.properties.get(className);
  const notOwn = (name: string) => !ownProperties?.has(name);
  const ownGrmRules = own.grmRules.get(className);
  return {
    classes: artifacts.classes.map((c) => ({
      className: c.className,
      parentClassName: own.parents.has(className) ? undefined : c.parentClassName,
      attributes: c.attributes.filter((a) => notOwn(a.name)),
    })),
    attaches: artifacts.attaches.map((a) => ({
      className: a.className,
      attributes: a.attributes.filter((attr) => notOwn(attr.name)),
    })),
    compoundRules: artifacts.compoundRules.filter((r) => notOwn(r.destPropertyName)),
    grmRules: artifacts.grmRules.filter((r) => !ownGrmRules?.has(grmRuleKey(r))),
    lovAttaches: artifacts.lovAttaches.filter((a) => !own.lovAttaches.has(lovAttachKey(a))),
  };
}

/** IV7: composite identifier of an LOV attachment. */
function lovAttachKey(attach: RawLovAttach): string {
  return [attach.typeName, attach.valuePropertyName, attach.lovName, attach.conditionName].join(
    '\u0000',
  );
}

/** Groups the artifacts of one file by the class they are about. */
function indexByClass(file: ParsedFile): Map<string, ClassArtifacts> {
  const index = new Map<string, ClassArtifacts>();
  const of = (name: string) => {
    let artifacts = index.get(name);
    if (!artifacts) {
      artifacts = emptyArtifacts();
      index.set(name, artifacts);
    }
    return artifacts;
  };
  file.classes.forEach((c) => of(c.className).classes.push(c));
  file.attaches.forEach((a) => of(a.className).attaches.push(a));
  file.compoundRules.forEach((r) => of(r.destTypeName).compoundRules.push(r));
  file.grmRules.forEach((r) => of(r.relationTypeName).grmRules.push(r));
  file.lovAttaches.forEach((a) => of(a.typeName).lovAttaches.push(a));
  return index;
}

function emptyArtifacts(): ClassArtifacts {
  return { classes: [], attaches: [], compoundRules: [], grmRules: [], lovAttaches: [] };
}
