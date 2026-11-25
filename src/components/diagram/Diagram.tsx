import { Background, Controls, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DiagramData } from '../../layout/layout';
import { ClassNodeView } from './ClassNode';

const nodeTypes = { umlClass: ClassNodeView };

/** The class diagram area (UI1, UI2). Classes are not selectable (UI4). */
export function Diagram({ nodes, edges }: DiagramData) {
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
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
