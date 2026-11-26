import { useState } from 'react';
import { useSelection, type SelectedProperty } from '../../app/selection';
import type { AttributeLov } from '../../model/types';

/**
 * Properties panel with Main and LOV tabs (UI8). Main shows the selected
 * attribute (AR1), compound property (AR2), or relation class (AR3); the LOV
 * tab appears only for attributes with LOV attachments (AR4).
 */
export function PropertiesPanel() {
  const { selected } = useSelection();
  // The chosen tab is tied to the selection it was made for, so a new
  // selection falls back to the Main default without effects (UI8).
  const [tabChoice, setTabChoice] = useState<{
    selection: SelectedProperty | null;
    tab: 'main' | 'lov';
  }>({ selection: null, tab: 'main' });
  const tab = tabChoice.selection === selected ? tabChoice.tab : 'main';

  const lovs = selected?.kind === 'attribute' ? selected.attribute.lovs : [];
  const hasLov = lovs.length > 0;
  const activeTab = tab === 'lov' && hasLov ? 'lov' : 'main';

  const tabButton = (id: 'main' | 'lov', label: string) => (
    <button
      type="button"
      className={'props-tab' + (activeTab === id ? ' props-tab--active' : '')}
      onClick={() => setTabChoice({ selection: selected, tab: id })}
    >
      {label}
    </button>
  );

  return (
    <aside className="props-panel">
      <h2 className="props-panel__title">Properties</h2>
      <div className="props-tabs">
        {tabButton('main', 'Main')}
        {hasLov && tabButton('lov', 'LOV')}
      </div>
      {activeTab === 'lov' ? <LovContent lovs={lovs} /> : <MainContent />}
    </aside>
  );
}

function MainContent() {
  const { selected } = useSelection();

  if (!selected) {
    return <p className="props-panel__empty">Select an attribute in the diagram.</p>;
  }

  // AR3: class name, then one block per GRM rule.
  if (selected.kind === 'relationClass') {
    return (
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
    );
  }

  let rows: Array<[string, string]>;
  if (selected.kind === 'attribute') {
    const attr = selected.attribute;
    rows = [
      ['attributeName', attr.name],
      ['type', attr.type],
    ];
    if (attr.arrayFlagValue !== undefined && attr.arrayFlagValue !== '') {
      rows.push([attr.arrayFlagName, attr.arrayFlagValue]);
    }
    rows.push(...Object.entries(attr.chars));
  } else {
    const compound = selected.compound;
    rows = [
      ['destPropertyName', compound.name],
      ['type', compound.type],
      ...Object.entries(compound.chars),
    ];
  }

  return (
    <dl className="props-panel__list">
      {rows.map(([name, value]) => (
        <div key={name} className="props-panel__row">
          {name} : {value}
        </div>
      ))}
    </dl>
  );
}

/** AR4: one block per LOV attachment. */
function LovContent({ lovs }: { lovs: AttributeLov[] }) {
  return (
    <dl className="props-panel__list">
      {lovs.map((lov, index) => (
        <div key={index} className={index > 0 ? 'props-panel__block' : undefined}>
          <div className="props-panel__row">lovName : {lov.name}</div>
          <div className="props-panel__row">conditionName : {lov.condition}</div>
          {lov.values === undefined ? (
            <div className="props-panel__row props-panel__row--missing">
              LOV "{lov.name}" not found
            </div>
          ) : (
            <>
              <div className="props-panel__row props-panel__row--heading">values:</div>
              {lov.values.map((entry, valueIndex) => (
                <div key={valueIndex} className="props-panel__row">
                  {entry.value} : {entry.description === '' ? 'NA' : entry.description}
                </div>
              ))}
            </>
          )}
        </div>
      ))}
    </dl>
  );
}
