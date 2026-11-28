import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { selectedName, useSelection, type SelectedProperty } from '../../app/selection';
import { attributeLabel, compoundLabel, type ClassNode } from '../../layout/layout';
import type { AttributeChange } from '../../model/selection';
import { Chevron } from '../common/Chevron';

/** UI13: tooltip of a changed attribute row. */
const CHANGE_TITLES: Record<AttributeChange, string> = {
  added: 'Added by this template',
  lov: 'LOV attached by this template',
};

/**
 * UML-style class node: name header plus one row per attribute and compound
 * property (UI3). Relation class nodes are colored and selectable (UI7, AR3).
 * Classes from dependency templates show the template name (UI12). The rows
 * can be collapsed with the header arrow (UI14); attributes changed by the
 * main template are highlighted (UI13).
 */
export function ClassNodeView({ data }: NodeProps<ClassNode>) {
  const { selected, select } = useSelection();
  // UI15: the initial state comes from the layout; toggling does not re-layout.
  const [expanded, setExpanded] = useState(data.initiallyExpanded);

  const isSelected = (name: string) =>
    selected !== null && selected.className === data.className && selectedName(selected) === name;
  const isClassSelected =
    selected?.kind === 'relationClass' && selected.className === data.className;

  const row = (
    name: string,
    label: string,
    selection: SelectedProperty,
    change?: AttributeChange,
  ) => (
    <li
      key={name}
      className={
        'uml-attr' +
        (change ? ' uml-attr--changed' : '') +
        (isSelected(name) ? ' uml-attr--selected' : '')
      }
      title={change ? CHANGE_TITLES[change] : undefined}
      onClick={(event) => {
        event.stopPropagation();
        select(selection);
      }}
    >
      {label}
    </li>
  );

  const hasRows = data.attributes.length + data.compounds.length > 0;
  const classNames = [
    'uml-class',
    data.isMainTemplate ? 'uml-class--main' : '',
    data.isRelationClass ? 'uml-class--relation' : '',
    isClassSelected ? 'uml-class--selected' : '',
    expanded ? '' : 'uml-class--collapsed',
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
      <div className="uml-class__name">
        {hasRows && (
          <button
            type="button"
            className="icon-button uml-class__toggle nodrag"
            title={expanded ? 'Collapse attributes' : 'Expand attributes'}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
          >
            <Chevron direction={expanded ? 'down' : 'right'} />
          </button>
        )}
        {data.className}
        {data.templateLabel && (
          <div className="uml-class__template">{data.templateLabel}</div>
        )}
      </div>
      {expanded && (
        <ul className="uml-class__attrs">
          {data.attributes.map((attr) =>
            row(
              attr.name,
              attributeLabel(attr),
              { className: data.className, kind: 'attribute', attribute: attr },
              data.changes[attr.name],
            ),
          )}
          {data.compounds.map((compound) =>
            row(compound.name, compoundLabel(compound), {
              className: data.className,
              kind: 'compound',
              compound,
            }),
          )}
        </ul>
      )}
      <Handle
        type="target"
        position={Position.Bottom}
        className="uml-handle"
        isConnectable={false}
      />
    </div>
  );
}
