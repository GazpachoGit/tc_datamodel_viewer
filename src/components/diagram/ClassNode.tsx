import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSelection } from '../../app/selection';
import { attributeLabel, type ClassNode } from '../../layout/layout';

/** UML-style class node: name header plus one row per attribute (UI3). */
export function ClassNodeView({ data }: NodeProps<ClassNode>) {
  const { selected, select } = useSelection();
  return (
    <div className="uml-class">
      <Handle type="source" position={Position.Top} className="uml-handle" isConnectable={false} />
      <div className="uml-class__name">{data.className}</div>
      <ul className="uml-class__attrs">
        {data.attributes.map((attr) => {
          const isSelected =
            selected?.className === data.className && selected.attribute.name === attr.name;
          return (
            <li
              key={attr.name}
              className={'uml-attr' + (isSelected ? ' uml-attr--selected' : '')}
              onClick={(event) => {
                event.stopPropagation();
                select({ className: data.className, attribute: attr });
              }}
            >
              {attributeLabel(attr)}
            </li>
          );
        })}
      </ul>
      <Handle
        type="target"
        position={Position.Bottom}
        className="uml-handle"
        isConnectable={false}
      />
    </div>
  );
}
