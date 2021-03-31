import { ResourceList } from './ResourceList';
import { Asset } from './Asset';
import { MockContentHub } from '../ContentHub.mocks';

describe('ResourceList tests', () => {
  test('creation and to JSON', async () => {
    const list = {
      data: [{ id: 'example1' }, { id: 'example2' }],
      count: 2
    };

    const resList = new ResourceList<Asset>(Asset, list);
    resList.setClient(new MockContentHub().mockClient);

    expect(resList.getItems().map(asset => asset.toJSON())).toEqual(list.data);

    // When converting to a list and back, we should get the same data.
    const json = resList.toJSON();

    expect(json).toEqual(list);
  });
});
