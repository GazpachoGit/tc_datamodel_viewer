import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';
import { IMAN_RELATION } from '../model/builder';
import { attributeChange, type AttributeChange } from '../model/selection';
import type { GrmRule, Model, UmlAttribute, UmlClass, UmlCompound } from '../model/types';

export interface ClassNodeData extends Record<string, unknown> {
  className: string;
  attributes: UmlAttribute[];
  compounds: UmlCompound[];
  /** True for relation classes: ImanRelation is among the ancestors (UI7). */
  isRelationClass: boolean;
  /** Display name of the dependency template declaring the class (UI12). */
  templateLabel?: string;
  grmRules: GrmRule[];
  /** True for classes declared by the main template (UI3 color). */
  isMainTemplate: boolean;
  /**
   * UI15: attributes are shown on first render for the main template's
   * classes and for classes with attributes changed by it (UI13).
   */
  initiallyExpanded: boolean;
  /** UI13: attributes changed by the main template, by attribute name. */
  changes: Record<string, AttributeChange>;
}

export type ClassNode = Node<ClassNodeData, 'umlClass'>;

export interface DiagramData {
  nodes: ClassNode[];
  edges: Edge[];
}

const HEADER_HEIGHT = 34;
const TEMPLATE_LABEL_HEIGHT = 15;
const TOGGLE_WIDTH = 22;
const ROW_HEIGHT = 21;
const CHAR_WIDTH = 7.5;
const H_PADDING = 24;
const MIN_WIDTH = 140;

export function attributeLabel(attr: UmlAttribute): string {
  return `${attr.name} : ${attr.type}${attr.isArray ? '[]' : ''}`;
}

export function compoundLabel(compound: UmlCompound): string {
  return `${compound.name} : ${compound.type}`;
}

function nodeSize(data: ClassNodeData): { width: number; height: number } {
  const textLengths = [
    data.className.length + 2,
    ...data.attributes.map((a) => attributeLabel(a).length),
    ...data.compounds.map((c) => compoundLabel(c).length),
  ];
  const width =
    Math.max(MIN_WIDTH, Math.max(...textLengths) * CHAR_WIDTH + H_PADDING) + TOGGLE_WIDTH;
  const header = HEADER_HEIGHT + (data.templateLabel ? TEMPLATE_LABEL_HEIGHT : 0);
  // UI15: the layout follows the initial state; a collapsed node is its header.
  if (!data.initiallyExpanded) {
    return { width, height: header };
  }
  const rowCount = data.attributes.length + data.compounds.length;
  return { width, height: header + Math.max(1, rowCount) * ROW_HEIGHT };
}

/** UI7: a relation class has ImanRelation among its ancestors. */
export function isRelationClass(umlClass: UmlClass): boolean {
  return umlClass.ancestors.includes(IMAN_RELATION);
}

export interface LayoutOptions {
  /** Names of the classes to render (UI12); all classes when omitted. */
  visible?: Set<string>;
  /** Template display name shown in the node of a class (UI12). */
  templateLabel?: (umlClass: UmlClass) => string | undefined;
  /**
   * Name of the main template: its classes start expanded (UI15) and
   * changes to dependency attributes are marked (UI13). When omitted, every
   * class starts expanded and nothing is marked.
   */
  mainTemplate?: string;
}

/**
 * Converts the model into a graph and computes node positions with an
 * ELK layered layout (parents above children).
 */
export async function layoutModel(
  model: Model,
  options: LayoutOptions = {},
): Promise<DiagramData> {
  const elk = new ELK();

  // UI6: the ImanRelation class and all edges connected to it are hidden.
  // UI12: only visible classes are rendered.
  const shown = (name: string) =>
    name !== IMAN_RELATION && (options.visible?.has(name) ?? model.classes.has(name));
  const classes = Array.from(model.classes.values()).filter((c) => shown(c.name));

  const { mainTemplate } = options;
  const nodeData: ClassNodeData[] = classes.map((umlClass) => {
    const attributes = Array.from(umlClass.attributes.values());
    const changes: Record<string, AttributeChange> = {};
    if (mainTemplate !== undefined) {
      for (const attribute of attributes) {
        const change = attributeChange(umlClass, attribute, mainTemplate);
        if (change) {
          changes[attribute.name] = change;
        }
      }
    }
    return {
      className: umlClass.name,
      attributes,
      compounds: Array.from(umlClass.compounds.values()),
      isRelationClass: isRelationClass(umlClass),
      templateLabel: options.templateLabel?.(umlClass),
      grmRules: umlClass.grmRules,
      isMainTemplate: mainTemplate !== undefined && umlClass.template === mainTemplate,
      initiallyExpanded:
        mainTemplate === undefined ||
        umlClass.template === mainTemplate ||
        Object.keys(changes).length > 0,
      changes,
    };
  });

  // Inheritance edges (UI2) and relation edges (NF9), kept apart for styling;
  // only between rendered classes (UI12).
  const inheritanceEdges = classes
    .filter((c) => c.parent !== undefined && shown(c.parent))
    .map((c) => ({
      id: `${c.name}-inherits-${c.parent}`,
      sources: [c.name],
      targets: [c.parent as string],
    }));
  const relationEdges = classes.flatMap((c) =>
    Array.from(c.relations)
      .filter((relationName) => shown(relationName))
      .map((relationName) => ({
        id: `${c.name}-relation-${relationName}`,
        sources: [c.name],
        targets: [relationName],
      })),
  );

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'UP',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    },
    children: nodeData.map((data) => ({ id: data.className, ...nodeSize(data) })),
    edges: [...inheritanceEdges, ...relationEdges],
  };

  const laidOut = await elk.layout(elkGraph);
  const positions = new Map(
    (laidOut.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]),
  );

  const nodes: ClassNode[] = nodeData.map((data) => ({
    id: data.className,
    type: 'umlClass',
    position: positions.get(data.className) ?? { x: 0, y: 0 },
    data,
    draggable: true,
    selectable: false,
  }));

  const edges: Edge[] = [
    ...inheritanceEdges.map((edge) => ({
      id: edge.id,
      source: edge.sources[0],
      target: edge.targets[0],
      type: 'straight',
      markerEnd: 'url(#uml-inheritance)',
    })),
    ...relationEdges.map((edge) => ({
      id: edge.id,
      source: edge.sources[0],
      target: edge.targets[0],
      type: 'straight',
      className: 'edge-relation',
      markerEnd: 'url(#uml-relation)',
    })),
  ];

  return { nodes, edges };
}
