import type { TemplateInfo } from '../../model/types';

interface TemplatesPanelProps {
  templates: TemplateInfo[];
  /** Name of the selected template, if any. */
  selected: string | null;
  /** While a template loads, clicks are ignored (UI11). */
  loading: boolean;
  onSelect: (template: TemplateInfo) => void;
}

/** Templates panel (UI10): display names, sorted, selected one highlighted. */
export function TemplatesPanel({ templates, selected, loading, onSelect }: TemplatesPanelProps) {
  return (
    <aside className={'templates-panel' + (loading ? ' templates-panel--loading' : '')}>
      <h2 className="templates-panel__title">Templates</h2>
      {templates.length === 0 ? (
        <p className="templates-panel__empty">No templates found.</p>
      ) : (
        <ul className="templates-panel__list">
          {templates.map((template) => (
            <li key={template.name}>
              <button
                type="button"
                title={template.name}
                className={
                  'templates-panel__item' +
                  (template.name === selected ? ' templates-panel__item--selected' : '')
                }
                disabled={loading}
                onClick={() => onSelect(template)}
              >
                {template.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
