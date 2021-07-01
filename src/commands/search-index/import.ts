import { EnrichedSearchIndex } from './export';

type IndexName = string;
type IndexFile = string;

export const validateNoDuplicateIndexNames = (importedIndices: {
  [filename: string]: EnrichedSearchIndex;
}): void | never => {
  const nameToFilenameMap = new Map<IndexName, IndexFile[]>(); // map: name x filenames
  for (const [filename, index] of Object.entries(importedIndices)) {
    if (index.name) {
      const otherFilenames: string[] = nameToFilenameMap.get(index.name) || [];
      if (filename) {
        nameToFilenameMap.set(index.name, [...otherFilenames, filename]);
      }
    }
  }
  const uniqueDuplicateNames: [string, IndexFile[]][] = [];
  nameToFilenameMap.forEach((filenames, name) => {
    if (filenames.length > 1) {
      uniqueDuplicateNames.push([name, filenames]);
    }
  });

  if (uniqueDuplicateNames.length > 0) {
    throw new Error(
      `Indices must have unique name values. Duplicate values found:-\n${uniqueDuplicateNames
        .map(([name, filenames]) => `  name: '${name}' in files: [${filenames.map(f => `'${f}'`).join(', ')}]`)
        .join('\n')}`
    );
  }
};
