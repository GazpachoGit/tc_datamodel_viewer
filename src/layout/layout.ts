import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';
import type { Model, UmlAttribute } from '../model/types';

export interface ClassNodeData extends Record<string, unknown> {
  className: string;
  attributes: UmlAttribute[];
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

function nodeSize(data: ClassNodeData): { width: number; height: number } {
  const textLengths = [
    data.className.length + 2,
    ...data.attributes.map((a) => attributeLabel(a).length),
  ];
  const width = Math.max(MIN_WIDTH, Math.max(...textLengths) * CHAR_WIDTH + H_PADDING);
  const height = HEADER_HEIGHT + Math.max(1, data.attributes.length) * ROW_HEIGHT;
  return { width, height };
}

/**
 * Converts the model into a graph and computes node positions with an
 * ELK layered layout (parents above children).
 */
export async function layoutModel(model: Model): Promise<DiagramData> {
  const elk = new ELK();

  const nodeData = Array.from(model.classes.values()).map((umlClass) => ({
    className: umlClass.name,
    attributes: Array.from(umlClass.attributes.values()),
  }));

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'UP',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    },
    children: nodeData.map((data) => ({ id: data.className, ...nodeSize(data) })),
    edges: Array.from(model.classes.values())
      .filter((c) => c.parent)
      .map((c) => ({
        id: `${c.name}->${c.parent}`,
        sources: [c.name],
        targets: [c.parent as string],
      })),
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

  const edges: Edge[] = (elkGraph.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.sources[0],
    target: edge.targets[0],
    type: 'straight',
    markerEnd: 'url(#uml-inheritance)',
  }));

  return { nodes, edges };
}
