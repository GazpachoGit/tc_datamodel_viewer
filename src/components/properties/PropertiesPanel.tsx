import { useSelection } from '../../app/selection';

/**
 * Properties panel for the selected attribute (UI5, AR1): attribute name,
 * mapped type, array flag under its original XML name, and non-empty
 * characteristics, one `name : value` line each.
 */
export function PropertiesPanel() {
  const { selected } = useSelection();

  let rows: Array<[string, string]> = [];
  if (selected) {
    const attr = selected.attribute;
    rows = [
      ['attributeName', attr.name],
      ['type', attr.type],
    ];
    if (attr.arrayFlagValue !== undefined && attr.arrayFlagValue !== '') {
      rows.push([attr.arrayFlagName, attr.arrayFlagValue]);
    }
    rows.push(...Object.entries(attr.chars));
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
