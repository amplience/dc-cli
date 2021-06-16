import { MockContentHub } from '../ContentHub.mocks';

describe('AxiosHttpClient tests', () => {
  test('get asset by id', async () => {
    const client = new MockContentHub();
    const result = await client.assets.get('65d78690-bf4e-415d-a16c-ca4dadbb2717');

    expect(result.label).toEqual('AlltheLook1.jpg');
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

  test('get asset by id (failures)', async () => {
    const client = new MockContentHub();
    const fail404 = client.assets.get('fail404');

    await expect(fail404).rejects.toThrow();

    const badId = client.assets.get('badId');

    await expect(badId).rejects.toThrow();
  });
});
