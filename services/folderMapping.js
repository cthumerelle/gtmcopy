export const planFolderMapping = (sourceFolders, sourceElements, destFolders) => {
  const usedFolderIds = new Set(sourceElements.map(el => el.parentFolderId).filter(Boolean));
  const folderMap = {};
  const foldersToCreate = [];

  for (const folder of sourceFolders) {
    if (!usedFolderIds.has(folder.folderId)) continue;
    const existing = destFolders.find(f => f.name === folder.name);
    if (existing) {
      folderMap[folder.folderId] = existing.folderId;
    } else {
      foldersToCreate.push(folder);
    }
  }

  return { folderMap, foldersToCreate };
};

export const withTargetFolder = (element, folderMap) => {
  const { parentFolderId, ...rest } = element;
  const targetFolderId = parentFolderId && folderMap[parentFolderId];
  return targetFolderId ? { ...rest, parentFolderId: targetFolderId } : rest;
};
