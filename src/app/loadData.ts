import mappingYaml from '../../spec/mapping.yaml?raw';
import { buildModel } from '../model/builder';
import { parseMapping } from '../model/mapping';
import { parseTcXml } from '../model/parser';
import type { Model } from '../model/types';

// IN1, IN2: bundle XML files directly in src/data/xml, no subdirectories.
const xmlFiles = import.meta.glob('../data/xml/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Loads the bundled XML files and mapping and builds the model (NF1-NF7). */
export function loadModel(): Model {
  const mapping = parseMapping(mappingYaml);
  const files = Object.entries(xmlFiles).map(([path, text]) =>
    parseTcXml(path.split('/').pop() ?? path, text),
  );
  return buildModel(files, mapping);
}
