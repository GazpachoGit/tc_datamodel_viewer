import { useEffect, useMemo, useState } from 'react';
import { Diagram } from '../components/diagram/Diagram';
import { SidePanel } from '../components/common/SidePanel';
import { PropertiesPanel } from '../components/properties/PropertiesPanel';
import { TemplatesPanel } from '../components/templates/TemplatesPanel';
import type { TemplateInfo } from '../model/types';
import { SelectionContext, type SelectedProperty } from './selection';
import { listTemplates, loadTemplate, type TemplateView } from './templates';

/** State of the diagram area (UI9, UI11, IV4). */
type DiagramState =
  | { kind: 'empty' }
  | { kind: 'loading'; template: TemplateInfo }
  | { kind: 'ready'; view: TemplateView }
  | { kind: 'error'; template: TemplateInfo; message: string };

/** LT1, LT2: the template list from the server. */
type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; templates: TemplateInfo[] }
  | { kind: 'error'; message: string };

export default function App() {
  const [templateList, setTemplateList] = useState<ListState>({ kind: 'loading' });
  const [state, setState] = useState<DiagramState>({ kind: 'empty' });
  const [selected, setSelected] = useState<SelectedProperty | null>(null);
  // UI17: both side panels can be collapsed to a tab.
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);

  const selection = useMemo(() => ({ selected, select: setSelected }), [selected]);

  useEffect(() => {
    let cancelled = false;
    listTemplates().then(
      (templates) => !cancelled && setTemplateList({ kind: 'ready', templates }),
      (e: unknown) =>
        !cancelled &&
        setTemplateList({ kind: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // LT2: an unreachable server or a malformed dependency file is an application error.
  if (templateList.kind === 'error') {
    return (
      <div className="error-screen">
        <h1>Failed to read the template list</h1>
        <pre className="error-screen__message">{templateList.message}</pre>
      </div>
    );
  }
  if (templateList.kind === 'loading') {
    return <div className="loading">Loading templates…</div>;
  }
  const templates = templateList.templates;

  const loading = state.kind === 'loading';
  const selectedTemplate =
    state.kind === 'empty' ? null : state.kind === 'ready' ? state.view.info : state.template;

  // UI11, TL1-TL6: load the clicked template; clicks during loading are ignored.
  const openTemplate = async (template: TemplateInfo) => {
    if (loading) {
      return;
    }
    setSelected(null);
    setState({ kind: 'loading', template });
    try {
      const view = await loadTemplate(template, templates);
      setState({ kind: 'ready', view });
    } catch (e) {
      setState({
        kind: 'error',
        template,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <SelectionContext.Provider value={selection}>
      <div className="app">
        <SidePanel
          side="left"
          title="Templates"
          open={templatesOpen}
          onToggle={() => setTemplatesOpen((open) => !open)}
        >
          <TemplatesPanel
            templates={templates}
            selected={selectedTemplate?.name ?? null}
            loading={loading}
            onSelect={openTemplate}
          />
        </SidePanel>
        <DiagramArea state={state} />
        <SidePanel
          side="right"
          title="Properties"
          open={propertiesOpen}
          onToggle={() => setPropertiesOpen((open) => !open)}
        >
          <PropertiesPanel />
        </SidePanel>
      </div>
    </SelectionContext.Provider>
  );
}

function DiagramArea({ state }: { state: DiagramState }) {
  switch (state.kind) {
    case 'empty': // UI9
      return <div className="diagram-placeholder">Select a template on the left.</div>;
    case 'loading': // UI11
      return (
        <div className="diagram-placeholder">
          Loading template "{state.template.displayName}"…
        </div>
      );
    case 'error': // IV4: the templates panel stays available.
      return (
        <div className="diagram-placeholder diagram-placeholder--error">
          <h1>Failed to build template "{state.template.displayName}"</h1>
          <pre className="error-screen__message">{state.message}</pre>
        </div>
      );
    case 'ready':
      return (
        <Diagram
          key={state.view.info.name}
          nodes={state.view.diagram.nodes}
          edges={state.view.diagram.edges}
        />
      );
  }
}
