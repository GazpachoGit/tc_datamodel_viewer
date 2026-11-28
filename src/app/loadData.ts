import { buildModel } from '../model/builder';
import { parseTcXml } from '../model/parser';
import type { Model } from '../model/types';

// IN1, IN2: bundle XML files directly in src/data/xml, no subdirectories.
const xmlFiles = import.meta.glob('../data/xml/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Loads the bundled XML files and builds the model (NF1-NF11). */
export function loadModel(): Model {
  const files = Object.entries(xmlFiles).map(([path, text]) =>
    parseTcXml(path.split('/').pop() ?? path, text),
  );
  return buildModel(files);
}
