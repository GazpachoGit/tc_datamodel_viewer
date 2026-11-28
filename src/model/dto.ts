import type {
  GrmRule,
  Model,
  TemplateInfo,
  UmlAttribute,
  UmlClass,
  UmlCompound,
} from './types';

/**
 * JSON form of the model for the API (model.md, DTO): Maps and Sets become
 * arrays in insertion order, everything else is kept as is.
 */
export interface ClassDto {
  name: string;
  template?: string;
  parent?: string;
  ancestors: string[];
  attributes: UmlAttribute[];
  compounds: UmlCompound[];
  relations: string[];
  grmRules: GrmRule[];
}

export interface ModelDto {
  template?: string;
  classes: ClassDto[];
}

/** Response of `GET /api/templates/:name` (TL6). */
export interface TemplateModelDto {
  info: TemplateInfo;
  model: ModelDto;
  /** Classes rendered on the diagram (UI12). */
  visibleClasses: string[];
}

export function modelToDto(model: Model): ModelDto {
  return {
    template: model.template,
    classes: Array.from(model.classes.values(), (c) => ({
      name: c.name,
      template: c.template,
      parent: c.parent,
      ancestors: c.ancestors,
      attributes: Array.from(c.attributes.values()),
      compounds: Array.from(c.compounds.values()),
      relations: Array.from(c.relations),
      grmRules: c.grmRules,
    })),
  };
}

export function modelFromDto(dto: ModelDto): Model {
  const classes = new Map<string, UmlClass>();
  for (const c of dto.classes) {
    classes.set(c.name, {
      name: c.name,
      template: c.template,
      parent: c.parent,
      ancestors: c.ancestors,
      attributes: new Map(c.attributes.map((a) => [a.name, a])),
      compounds: new Map(c.compounds.map((p) => [p.name, p])),
      relations: new Set(c.relations),
      grmRules: c.grmRules,
    });
  }
  return { template: dto.template, classes };
}
