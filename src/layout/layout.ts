import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';
import { IMAN_RELATION } from '../model/builder';
import type { GrmRule, Model, UmlAttribute, UmlCompound } from '../model/types';

export interface ClassNodeData extends Record<string, unknown> {
  className: string;
  attributes: UmlAttribute[];
  compounds: UmlCompound[];
  /** True for relation classes: direct parent is ImanRelation (UI7). */
  isRelationClass: boolean;
  grmRules: GrmRule[];
}

export type ClassNode = Node<ClassNodeData, 'umlClass'>;

export interface DiagramData {
  nodes: ClassNode[];
  edges: Edge[];
}

const HEADER_HEIGHT = 34;
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
  const width = Math.max(MIN_WIDTH, Math.max(...textLengths) * CHAR_WIDTH + H_PADDING);
  const rowCount = data.attributes.length + data.compounds.length;
  const height = HEADER_HEIGHT + Math.max(1, rowCount) * ROW_HEIGHT;
  return { width, height };
}

/**
 * Converts the model into a graph and computes node positions with an
 * ELK layered layout (parents above children).
 */
export async function layoutModel(model: Model): Promise<DiagramData> {
  const elk = new ELK();

  // UI6: the ImanRelation class and all edges connected to it are hidden.
  const classes = Array.from(model.classes.values()).filter((c) => c.name !== IMAN_RELATION);

  const nodeData = classes.map((umlClass) => ({
    className: umlClass.name,
    attributes: Array.from(umlClass.attributes.values()),
    compounds: Array.from(umlClass.compounds.values()),
    isRelationClass: umlClass.parent === IMAN_RELATION,
    grmRules: umlClass.grmRules,
  }));

  // Inheritance edges (UI2) and relation edges (NF9), kept apart for styling.
  const inheritanceEdges = classes
    .filter((c) => c.parent && c.parent !== IMAN_RELATION)
    .map((c) => ({
      id: `${c.name}-inherits-${c.parent}`,
      sources: [c.name],
      targets: [c.parent as string],
    }));
  const relationEdges = classes.flatMap((c) =>
    Array.from(c.relations)
      .filter((relationName) => relationName !== IMAN_RELATION)
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
