import { MockContentHub } from '../ContentHub.mocks';

describe('Settings tests', () => {
  test('get settings', async () => {
    const client = new MockContentHub();
    const result = await client.settings.get();

    expect(result.companyClassificationType).toEqual('Demo');
    expect(result.di.defaultEndpoint).toEqual('aaaaaaaa-bbbb-cccc-dddd-eeeeeeffffff');
  });
});
