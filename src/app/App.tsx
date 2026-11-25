import { useEffect, useMemo, useState } from 'react';
import { Diagram } from '../components/diagram/Diagram';
import { PropertiesPanel } from '../components/properties/PropertiesPanel';
import { layoutModel, type DiagramData } from '../layout/layout';
import { loadModel } from './loadData';
import { SelectionContext, type SelectedProperty } from './selection';

export default function App() {
  const [diagram, setDiagram] = useState<DiagramData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedProperty | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const model = loadModel();
        const data = await layoutModel(model);
        if (!cancelled) setDiagram(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selection = useMemo(() => ({ selected, select: setSelected }), [selected]);

  // IV4: on invalid input, show only the error message.
  if (error) {
    return (
      <div className="error-screen">
        <h1>Failed to build the data model</h1>
        <pre className="error-screen__message">{error}</pre>
      </div>
    );
  }

  if (!diagram) {
    return <div className="loading">Building the diagram…</div>;
  }

  return (
    <SelectionContext.Provider value={selection}>
      <div className="app">
        <Diagram nodes={diagram.nodes} edges={diagram.edges} />
        <PropertiesPanel />
      </div>
    </SelectionContext.Provider>
  );
}
