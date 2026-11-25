import { useSelection } from '../../app/selection';

/**
 * Properties panel for the selected attribute (UI5, AR1) or compound
 * property (AR2): one `name : value` line each, original XML names for
 * characteristics, non-empty values only.
 */
export function PropertiesPanel() {
  const { selected } = useSelection();

  let rows: Array<[string, string]> = [];
  if (selected?.kind === 'attribute') {
    const attr = selected.attribute;
    rows = [
      ['attributeName', attr.name],
      ['type', attr.type],
    ];
    if (attr.arrayFlagValue !== undefined && attr.arrayFlagValue !== '') {
      rows.push([attr.arrayFlagName, attr.arrayFlagValue]);
    }
    rows.push(...Object.entries(attr.chars));
  } else if (selected?.kind === 'compound') {
    const compound = selected.compound;
    rows = [
      ['destPropertyName', compound.name],
      ['type', compound.type],
      ...Object.entries(compound.chars),
    ];
  }

  // AR3: class name, then one block per GRM rule.
  if (selected?.kind === 'relationClass') {
    return (
      <aside className="props-panel">
        <h2 className="props-panel__title">Properties</h2>
        <dl className="props-panel__list">
          <div className="props-panel__row">className : {selected.className}</div>
          {selected.grmRules.map((rule, index) => (
            <div key={index} className="props-panel__block">
              <div className="props-panel__row props-panel__row--heading">GRMRule:</div>
              {Object.entries(rule.chars).map(([name, value]) => (
                <div key={name} className="props-panel__row">
                  {name} : {value}
                </div>
              ))}
            </div>
          ))}
        </dl>
      </aside>
    );
  }

  return (
    <aside className="props-panel">
      <h2 className="props-panel__title">Properties</h2>
      {selected ? (
        <dl className="props-panel__list">
          {rows.map(([name, value]) => (
            <div key={name} className="props-panel__row">
              {name} : {value}
            </div>
          ))}
        </dl>
      ) : (
        <p className="props-panel__empty">Select an attribute in the diagram.</p>
      )}
    </aside>
  );
}
