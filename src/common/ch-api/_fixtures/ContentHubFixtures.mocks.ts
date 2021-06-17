import MockAdapter from 'axios-mock-adapter';
import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import { resolve } from 'url';

interface ContentHubFixtureParameters {
  selectors?: string[];
  [K: string]: string | string[] | undefined;
}

function escapeForRegex(url: string): string {
  return url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export class DAMFixtures {
  static install(adapter: MockAdapter): void {
    // Load fixtures.

    const fixturesBaseDir = __dirname;

    this.installSpecific(adapter, fixturesBaseDir + '/assets', {
      id: '65d78690-bf4e-415d-a16c-ca4dadbb2717',
      version: '1'
    });
    this.installSpecific(adapter, fixturesBaseDir + '/assets', {
      id: '1f7b5ac6-bb0c-4cd1-b5a1-190ede681b8f',
      selectors: ['fail']
    });

    this.installSpecific(adapter, fixturesBaseDir + '/settings', {});
  }

  private static installSpecific(adapter: MockAdapter, baseDir: string, params: ContentHubFixtureParameters): void {
    // Scan the given folder for fixtures.

    // For each file, create register a response. Filenames follow a specific format:
    // uri/path/from/base/<METHOD>-{<parameter>}-<selector>.json
    // Any {paramater}s will be replaced with those provided, and be treated as the final directory name.
    // Parameters can also be on folder names, too. /assets/{id}/GET.json and /assets/GET-{id}.json are both valid.
    // Responses with selectors will only be registered if the specified selector has been provided.

    const contents = readdirSync(baseDir);

    contents.forEach(name => {
      const fullPath = join(baseDir, name);

      if (statSync(fullPath).isDirectory()) {
        // Continue traversal
        this.installSpecific(adapter, fullPath, params);
      } else if (fullPath.endsWith(`.json`)) {
        // Add this file as a response.
        this.installFile(adapter, fullPath, params);
      }
    });
  }

  private static installFile(adapter: MockAdapter, path: string, params: ContentHubFixtureParameters): void {
    const baseUri = 'https://dam-api.amplience.net/v1.5.0/';

    const baseName = basename(path, '.json');
    let dirName = relative(__dirname, dirname(path));

    const nameSplit = baseName.split('-');

    if (nameSplit.length === 0) return;

    const method = nameSplit[0];
    let pathExtension = '';
    let selectorCount = 0;

    for (let i = 1; i < nameSplit.length; i++) {
      const arg = nameSplit[i];

      if (arg.startsWith('{') && arg.endsWith('}')) {
        // Insert the given ID
        const paramName = arg.substr(1, arg.length - 2);

        if (params[paramName] != null) {
          pathExtension = params[paramName] as string;
        } else {
          return; // Skip this file.
        }
      } else {
        // Is this selector present in the params?
        selectorCount++;
        if (params.selectors == null || params.selectors.indexOf(arg) === -1) {
          return; // Skip this file.
        }
      }
    }

    if (selectorCount === 0 && params.selectors != null && params.selectors.length > 0) {
      return; // If selectors are present, only add responses that also have selectors.
    }

    for (let i = 0; i < dirName.length; i++) {
      if (dirName[i] === '{') {
        for (let j = i + 1; j < dirName.length; j++) {
          if (dirName[j] === '}') {
            const paramName = dirName.substring(i + 1, j);

            if (params[paramName] != null) {
              dirName = dirName.substring(0, i) + params[paramName] + dirName.substring(j + 1);
              break;
            } else {
              return; // Skip this file.
            }
          }
        }
      }
    }

    const response = JSON.parse(readFileSync(path, { encoding: 'utf8' }));
    let fullUri = resolve(baseUri, dirName);
    if (pathExtension !== '') {
      fullUri = resolve(fullUri + '/', pathExtension);
    }

    const responseCode = method === 'POST' ? 204 : 200;

    // Allow any url with query string
    const regex = new RegExp('^' + escapeForRegex(fullUri) + '(\\?.*$)?$');

    switch (method) {
      case 'GET':
        adapter.onGet(regex).reply(responseCode, response);
        break;
      case 'POST':
        adapter.onPost(regex).reply(responseCode, response);
        break;
      case 'PATCH':
        adapter.onPatch(regex).reply(responseCode, response);
        break;
      case 'PUT':
        adapter.onPut(regex).reply(responseCode, response);
        break;
      case 'DELETE':
        adapter.onDelete(regex).reply(responseCode, response);
        break;
    }
  }
}
