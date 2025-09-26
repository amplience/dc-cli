import { Extension } from 'dc-management-sdk-js';

export const filterExtensionsById = (
  listToFilter: Extension[],
  extensionUriList: string[],
  deleteExtensions: boolean = false
): Extension[] => {
  if (extensionUriList.length === 0) {
    return listToFilter;
  }

  const unmatchedExtensionUriList: string[] = extensionUriList.filter(
    id => !listToFilter.some(extension => extension.id === id)
  );
  if (unmatchedExtensionUriList.length > 0) {
    throw new Error(
      `The following extension URI(s) could not be found: [${unmatchedExtensionUriList
        .map(u => `'${u}'`)
        .join(', ')}].\nNothing was ${!deleteExtensions ? 'exported' : 'deleted'}, exiting.`
    );
  }

  return listToFilter.filter(extension => extensionUriList.some(id => extension.id === id));
};
