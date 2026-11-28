import { NO_PARENT } from './builder';
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
 * Returns the main file followed by the filtered dependency files, in the
 * given order (TL4).
 */
export function selectArtifacts(main: ParsedFile, deps: ParsedFile[]): ParsedFile[] {
  const indexes = deps.map(indexByClass);

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
      target.classes.push(...artifacts.classes);
      target.attaches.push(...artifacts.attaches);
      target.compoundRules.push(...artifacts.compoundRules);
      target.grmRules.push(...artifacts.grmRules);
      target.lovAttaches.push(...artifacts.lovAttaches);
      for (const rawClass of artifacts.classes) {
        const parent = rawClass.parentClassName;
        if (parent && parent !== NO_PARENT && !selected.has(parent)) {
          queue.push(parent);
        }
      }
      for (const attach of artifacts.lovAttaches) {
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
