import { useCallback, useState } from 'react';
import { Background, Controls, ReactFlow, type OnNodesChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { pushDownOverlaps } from '../../layout/collisions';
import type { ClassNode, DiagramData } from '../../layout/layout';
import { ClassNodeView } from './ClassNode';

const nodeTypes = { umlClass: ClassNodeView };

/** Vertical space kept between a grown node and the nodes it pushes (UI15). */
const PUSH_GAP = 24;

/**
 * The class diagram area (UI1, UI2). Classes are not selectable (UI4).
 * Node positions start from the layout and then live here: dragging moves
 * nodes, and a node that grows (UI14) pushes the nodes it overlaps down.
 */
export function Diagram({ nodes: initialNodes, edges }: DiagramData) {
  const [nodes, setNodes] = useState(initialNodes);

  const onNodesChange: OnNodesChange<ClassNode> = useCallback((changes) => {
    setNodes((previous) => {
      // Only growth of an already measured node pushes; the first measurement
      // and shrinking (collapsing) move nothing.
      const grown = changes.getByType('dimensions').flatMap((change) => {
        if (!change.dimensions) {
          return [];
        }
        const before = previous.find((node) => node.id === change.id)?.measured;
        if (!before?.width || !before.height) {
          return [];
        }
        const after = change.dimensions;
        return after.height > before.height + 0.5 || after.width > before.width + 0.5
          ? [change.id]
          : [];
      });

      let next = changes.applyTo(previous);
      for (const id of grown) {
        const moved = pushDownOverlaps(
          next.map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
            width: node.measured?.width ?? 0,
            height: node.measured?.height ?? 0,
          })),
          id,
          PUSH_GAP,
        );
        if (moved.size > 0) {
          next = next.map((node) => {
            const y = moved.get(node.id);
            return y === undefined ? node : { ...node, position: { ...node.position, y } };
          });
        }
      }
      return next;
    });
  }, []);

  return (
    <div className="diagram">
      <svg width="0" height="0">
        <defs>
          {/* Hollow triangle for UML inheritance (UI2). */}
          <marker
            id="uml-inheritance"
            viewBox="0 0 18 18"
            markerWidth="18"
            markerHeight="18"
            refX="17"
            refY="9"
            orient="auto"
          >
            <path d="M 1 1 L 17 9 L 1 17 Z" fill="#ffffff" stroke="#4a5568" strokeWidth="1.5" />
          </marker>
          {/* Open arrow for relation connections (UI2, NF9). */}
          <marker
            id="uml-relation"
            viewBox="0 0 14 14"
            markerWidth="14"
            markerHeight="14"
            refX="12"
            refY="7"
            orient="auto"
          >
            <path
              d="M 2 2 L 12 7 L 2 12"
              fill="none"
              stroke="#805ad5"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.05}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
