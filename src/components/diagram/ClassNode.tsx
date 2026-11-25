import { Handle, Position, type NodeProps } from '@xyflow/react';
import { selectedName, useSelection, type SelectedProperty } from '../../app/selection';
import { attributeLabel, compoundLabel, type ClassNode } from '../../layout/layout';

/**
 * UML-style class node: name header plus one row per attribute and compound
 * property (UI3). Relation class nodes are colored and selectable (UI7, AR3).
 */
export function ClassNodeView({ data }: NodeProps<ClassNode>) {
  const { selected, select } = useSelection();

  const isSelected = (name: string) =>
    selected !== null && selected.className === data.className && selectedName(selected) === name;
  const isClassSelected =
    selected?.kind === 'relationClass' && selected.className === data.className;

  const row = (name: string, label: string, selection: SelectedProperty) => (
    <li
      key={name}
      className={'uml-attr' + (isSelected(name) ? ' uml-attr--selected' : '')}
      onClick={(event) => {
        event.stopPropagation();
        select(selection);
      }}
    >
      {label}
    </li>
  );

  const classNames = [
    'uml-class',
    data.isRelationClass ? 'uml-class--relation' : '',
    isClassSelected ? 'uml-class--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      onClick={
        data.isRelationClass
          ? () =>
              select({ kind: 'relationClass', className: data.className, grmRules: data.grmRules })
          : undefined
      }
    >
      <Handle type="source" position={Position.Top} className="uml-handle" isConnectable={false} />
      <div className="uml-class__name">{data.className}</div>
      <ul className="uml-class__attrs">
        {data.attributes.map((attr) =>
          row(attr.name, attributeLabel(attr), {
            className: data.className,
            kind: 'attribute',
            attribute: attr,
          }),
        )}
        {data.compounds.map((compound) =>
          row(compound.name, compoundLabel(compound), {
            className: data.className,
            kind: 'compound',
            compound,
          }),
        )}
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
