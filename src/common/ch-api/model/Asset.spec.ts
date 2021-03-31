import { MockContentHub } from '../ContentHub.mocks';
import { Asset } from './Asset';
import { AssetPut } from './AssetPut';
import { StringList } from './StringList';

describe('AxiosHttpClient tests', () => {
  test('get asset by id', async () => {
    const client = new MockContentHub();
    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    expect(result.label).toEqual('AlltheLook1.jpg');
  });

  test('delete asset (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    await expect(result.related.delete()).resolves.toBe(undefined);
    // Did not throw.
  });

  test('delete asset (by id)', async () => {
    const client = new MockContentHub();

    const del = client.assets.delete('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    await expect(del).resolves.toBe(undefined);
    // Did not throw.
  });

  test('delete asset (by ids)', async () => {
    const client = new MockContentHub();

    const del = client.assets.deleteMany(['65d78690-bf4e-415d-a16c-ca4dadbb2717']);

    await expect(del).resolves.toEqual(expect.any(StringList));
    // Did not throw.
  });

  test('get versions (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const versions = await result.related.versions();

    let versionId = 5;
    versions.getItems().forEach(version => {
      expect(version.label).toEqual('AlltheLook1.jpg');
      expect(version.revisionNumber).toEqual(versionId--);
      expect(version.related).not.toBeUndefined();
    });
  });

  test('get versions (by id)', async () => {
    const client = new MockContentHub();

    const versions = await client.assets.versions('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    let versionId = 5;
    versions.getItems().forEach(version => {
      expect(version.label).toEqual('AlltheLook1.jpg');
      expect(version.revisionNumber).toEqual(versionId--);
      expect(version.related).not.toBeUndefined();
    });
  });

  test('get version (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const version1 = await result.related.version(1);

    expect(version1.revisionNumber).toEqual(1);
  });

  test('get version (by id)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.version('65d78690-bf4e-415d-a16c-ca4dadbb2717', 1);

    expect(result.label).toEqual('AlltheLook1.jpg');
    expect(result.revisionNumber).toEqual(1);
  });

  test('get download (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const downloadPath = await result.related.download();

    expect(downloadPath).toEqual('/assets/65d78690-bf4e-415d-a16c-ca4dadbb2717/download/handle?auth=example');
  });

  test('get download (by id)', async () => {
    const client = new MockContentHub();

    const downloadPath = await client.assets.download('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    expect(downloadPath).toEqual('/assets/65d78690-bf4e-415d-a16c-ca4dadbb2717/download/handle?auth=example');
  });

  test('get version download (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const downloadPath = await result.related.downloadVersion(1);

    expect(downloadPath).toEqual(
      '/assets/65d78690-bf4e-415d-a16c-ca4dadbb2717/versions/1/download/handle?revisionNumber=1&auth=example'
    );
  });

  test('get version download (by id)', async () => {
    const client = new MockContentHub();

    const downloadPath = await client.assets.downloadVersion('65d78690-bf4e-415d-a16c-ca4dadbb2717', 1);

    expect(downloadPath).toEqual(
      '/assets/65d78690-bf4e-415d-a16c-ca4dadbb2717/versions/1/download/handle?revisionNumber=1&auth=example'
    );
  });

  test('publish (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const publishJobs = await result.related.publish('UI');

    expect(publishJobs.getItems()).toEqual(['publish.8d1bb161-4de3-4cc7-a907-29636842032a']);
  });

  test('publish (by ids)', async () => {
    const client = new MockContentHub();

    const publishJobs = await client.assets.publish(['65d78690-bf4e-415d-a16c-ca4dadbb2717']);

    expect(publishJobs.getItems()).toEqual(['publish.8d1bb161-4de3-4cc7-a907-29636842032a']);
  });

  test('validate publish (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const publishJobs = await result.related.validatePublish('UI');

    // Returns a null list, but does not throw.
    expect(publishJobs.getItems()).toBeUndefined();
  });

  test('validate publish (by ids)', async () => {
    const client = new MockContentHub();

    const publishJobs = await client.assets.validatePublish(['65d78690-bf4e-415d-a16c-ca4dadbb2717']);

    // Returns a null list, but does not throw.
    expect(publishJobs.getItems()).toBeUndefined();
  });

  test('unpublish (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const publishJobs = await result.related.unpublish('UI');

    expect(publishJobs.getItems()).toEqual(['unpublish.8f0034fd-e0e7-4a55-a81b-a87054827a8f']);
  });

  test('unpublish (by ids)', async () => {
    const client = new MockContentHub();

    const publishJobs = await client.assets.unpublish(['65d78690-bf4e-415d-a16c-ca4dadbb2717']);

    expect(publishJobs.getItems()).toEqual(['unpublish.8f0034fd-e0e7-4a55-a81b-a87054827a8f']);
  });

  test('text (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const text = await result.related.text();

    expect(text.id).toEqual('65d78690-bf4e-415d-a16c-ca4dadbb2717');
    expect(text.status).toEqual('INTERNAL');
    expect(text.data).toEqual('Text Content Example');
  });

  test('text (by id)', async () => {
    const client = new MockContentHub();

    const text = await client.assets.text('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    expect(text.id).toEqual('65d78690-bf4e-415d-a16c-ca4dadbb2717');
    expect(text.status).toEqual('INTERNAL');
    expect(text.data).toEqual('Text Content Example');
  });

  test('get metadata (self)', async () => {
    const client = new MockContentHub();

    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    const metadata = await result.related.metadata();

    expect(metadata.metadata.map(meta => meta.schema)).toEqual(['exif', 'file', 'image']);
  });

  test('get metadata (by id)', async () => {
    const client = new MockContentHub();

    const metadata = await client.assets.metadata('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    expect(metadata.metadata.map(meta => meta.schema)).toEqual(['exif', 'file', 'image']);
  });

  test('list assets', async () => {
    const client = new MockContentHub();

    const list = await client.assets.list({ q: 'example search query' });
    const items = list.getItems();

    expect(items.map(item => item.label)).toEqual(['AlltheLook1.jpg', '1.png']);

    items.forEach(version => {
      expect(version.related).not.toBeUndefined();
    });
  });

  const assetStrip = ['revisionNum', 'userId', 'file', 'createdDate', 'timestamp', 'tags'];

  function sharedPut(client: MockContentHub, requestIds: string[]): void {
    for (let i = 0; i < requestIds.length; i++) {
      const request = client.mock.history.put[i];

      expect(request.url).toEqual('https://dam-api.amplience.net/v1.5.0/assets');

      // Must strip reserved fields from body.

      const data = JSON.parse(request.data);
      expect(data.assets[0].id).toEqual(requestIds[i]);
      data.assets.forEach((asset: Asset) => {
        expect(asset.label).toEqual('Replacement label');

        assetStrip.forEach(stripped => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((asset as any)[stripped]).toBeUndefined();
        });
      });
    }
  }

  test('put assets (by ids)', async () => {
    const client = new MockContentHub();

    const list = await client.assets.list();
    const items = list.getItems();

    items.forEach(item => (item.label = 'Replacement label'));

    const result = await client.assets.putAsset('overwrite', items);

    expect(result.results).toEqual(items.map(item => ({ id: item.id, status: 'succeeded' })));

    sharedPut(client, ['65d78690-bf4e-415d-a16c-ca4dadbb2717']);
  });

  test('put assets (self)', async () => {
    const client = new MockContentHub();

    const list = await client.assets.list();
    const items = list.getItems();

    items.forEach(item => (item.label = 'Replacement label'));

    const result = [];

    for (const item of items) {
      item.label = 'Replacement label';
      result.push(await item.related.update());
    }

    sharedPut(client, ['65d78690-bf4e-415d-a16c-ca4dadbb2717', '4a0bcaed-ee57-481f-98d3-4b73aad49e68']);
  });

  test('put assets (using asset put interface)', async () => {
    const client = new MockContentHub();

    const assetPut: AssetPut = {
      id: '65d78690-bf4e-415d-a16c-ca4dadbb2717',
      tags: { add: [], remove: [] }
    };

    const result = await client.assets.put('overwrite', [assetPut]);

    expect(result.results[0]).toEqual({
      id: '65d78690-bf4e-415d-a16c-ca4dadbb2717',
      status: 'succeeded'
    });

    const request = client.mock.history.put[0];

    expect(request.url).toEqual('https://dam-api.amplience.net/v1.5.0/assets');

    const data = JSON.parse(request.data);
    expect(data.assets[0]).toEqual(assetPut);
  });

  test('get asset by id (failures)', async () => {
    const client = new MockContentHub();
    const fail404 = client.assets.get('fail404');

    await expect(fail404).rejects.toThrow();

    const badId = client.assets.get('badId');

    await expect(badId).rejects.toThrow();
  });
});
