import { layoutModel, type DiagramData } from '../layout/layout';
import { modelFromDto, type TemplateModelDto } from '../model/dto';
import type { Model, TemplateInfo } from '../model/types';

/** A built template on the client (model.md, TemplateView). */
export interface TemplateView {
  info: TemplateInfo;
  model: Model;
  /** Classes rendered on the diagram (UI12). */
  visibleClasses: Set<string>;
  diagram: DiagramData;
}

/** TL5 on the client: laid-out templates by name, for switching back. */
const views = new Map<string, Promise<TemplateView>>();

/** LT1: the template list from the server, sorted by display name (UI10). */
export async function listTemplates(): Promise<TemplateInfo[]> {
  return getJson<TemplateInfo[]>('/api/templates');
}

/**
 * Use case "Load a template": the server builds the model (TL1-TL5); the
 * client restores it and lays out the visible classes (TL6, UI12).
 */
export function loadTemplate(
  info: TemplateInfo,
  templates: TemplateInfo[],
): Promise<TemplateView> {
  let view = views.get(info.name);
  if (!view) {
    view = fetchView(info, templates);
    view.catch(() => views.delete(info.name));
    views.set(info.name, view);
  }
  return view;
}

async function fetchView(info: TemplateInfo, templates: TemplateInfo[]): Promise<TemplateView> {
  const dto = await getJson<TemplateModelDto>(`/api/templates/${encodeURIComponent(info.name)}`);
  const model = modelFromDto(dto.model);
  const visibleClasses = new Set(dto.visibleClasses);

  // UI12: classes declared in a dependency template show its display name.
  const displayNames = new Map(templates.map((t) => [t.name, t.displayName]));
  const diagram = await layoutModel(model, {
    visible: visibleClasses,
    templateLabel: (umlClass) =>
      umlClass.template && umlClass.template !== info.name
        ? (displayNames.get(umlClass.template) ?? umlClass.template)
        : undefined,
  });

  return { info, model, visibleClasses, diagram };
}

/** Fetches JSON; error responses carry `{ message }` (IV4, LT2). */
async function getJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw new Error(`The viewer server is not reachable: ${(e as Error).message}`, { cause: e });
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request ${url} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
