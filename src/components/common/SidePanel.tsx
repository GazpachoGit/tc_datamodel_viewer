import type { ReactNode } from 'react';
import { Chevron } from './Chevron';

interface SidePanelProps {
  /** Screen edge the panel is attached to. */
  side: 'left' | 'right';
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * UI17: a collapsible side panel. Open, its header has an arrow pointing to
 * its edge that collapses it; collapsed, only a tab with the title remains,
 * and clicking the tab opens the panel again.
 */
export function SidePanel({ side, title, open, onToggle, children }: SidePanelProps) {
  if (!open) {
    return (
      <button
        type="button"
        className={`side-tab side-tab--${side}`}
        title={`Show ${title.toLowerCase()}`}
        onClick={onToggle}
      >
        <Chevron direction={side === 'left' ? 'right' : 'left'} />
        <span className="side-tab__label">{title}</span>
      </button>
    );
  }
  return (
    <aside className={`side-panel side-panel--${side}`}>
      <div className="side-panel__header">
        <h2 className="side-panel__title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          title={`Hide ${title.toLowerCase()}`}
          onClick={onToggle}
        >
          <Chevron direction={side} />
        </button>
      </div>
      <div className="side-panel__body">{children}</div>
    </aside>
  );
}
