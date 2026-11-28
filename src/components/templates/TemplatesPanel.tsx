import { useState } from 'react';
import type { TemplateInfo } from '../../model/types';

interface TemplatesPanelProps {
  templates: TemplateInfo[];
  /** Name of the selected template, if any. */
  selected: string | null;
  /** While a template loads, clicks are ignored (UI11). */
  loading: boolean;
  onSelect: (template: TemplateInfo) => void;
}

/**
 * Content of the templates panel (UI10, UI16): a search field and the
 * display names, sorted, with the selected one highlighted.
 */
export function TemplatesPanel({ templates, selected, loading, onSelect }: TemplatesPanelProps) {
  const [query, setQuery] = useState('');

  // UI16: case-insensitive match on the name or the display name.
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(needle) || t.displayName.toLowerCase().includes(needle),
      )
    : templates;

  return (
    <div className={'templates-panel' + (loading ? ' templates-panel--loading' : '')}>
      <input
        type="search"
        className="templates-panel__search"
        placeholder="Search templates"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {templates.length === 0 ? (
        <p className="templates-panel__empty">No templates found.</p>
      ) : matches.length === 0 ? (
        <p className="templates-panel__empty">No matches.</p>
      ) : (
        <ul className="templates-panel__list">
          {matches.map((template) => (
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
    </div>
  );
}
