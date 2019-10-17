import fs from 'fs';

export interface RemoteFile {
  uri: string;
}

export const getRemoteFileList = (filePath: string): RemoteFile[] => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Unable to read remote file list: ${filePath}`);
  }
};
