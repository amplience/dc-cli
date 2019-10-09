import DataPresenter from './data-presenter';

const stdoutWriteSpy = jest.spyOn(process.stdout, 'write');

interface TestItem {
  foo: string;
  key: string;
}

describe('DataPresenter', (): void => {
  beforeAll(() => {
    stdoutWriteSpy.mockImplementation(() => true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('single item', function() {
    const singleItem: TestItem = {
      foo: 'bar',
      key: 'value '.repeat(20)
    };

    it('should render a single item vertical table', (): void => {
      new DataPresenter(singleItem).render();
      expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should render a single item as json', (): void => {
      new DataPresenter(singleItem).render({ json: true });
      expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should render a single item as vertical table using tableUserConfig', (): void => {
      new DataPresenter(singleItem).render({
        tableUserConfig: {
          columns: {
            1: {
              width: 100
            }
          }
        }
      });
      expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe('collection of items tests', function() {
    describe('collection of items', function() {
      const collectionOfItems: TestItem[] = [
        {
          foo: 'bar1',
          key: 'value1 '.repeat(20)
        },
        {
          foo: 'bar2',
          key: 'value2 '.repeat(20)
        }
      ];

      it('should render a collection of items in a horizontal table', (): void => {
        new DataPresenter(collectionOfItems).render();
        expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should render a collection of items as json', (): void => {
        new DataPresenter(collectionOfItems).render({ json: true });
        expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should render using the supplied map() for a collection of items in a horizontal table', (): void => {
        new DataPresenter(collectionOfItems).render({ itemMapFn: ({ foo }: TestItem): object => ({ foo }) });
        expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should render a collection of items horizontal table using with table config', (): void => {
        new DataPresenter(collectionOfItems).render({
          tableUserConfig: {
            columns: {
              1: {
                width: 100
              }
            }
          }
        });
        expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
      });
    });

    describe('collection of 0 items', function() {
      it('should render a collection of items in a horizontal table', (): void => {
        new DataPresenter([]).render();
        expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should render a collection of items as json', (): void => {
        new DataPresenter([]).render({ json: true });
        expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should render using the supplied map() for a collection of items in a horizontal table', (): void => {
        new DataPresenter([]).render({ itemMapFn: ({ foo }: TestItem): object => ({ foo }) });
        expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should render a collection of items horizontal table using with table config', (): void => {
        new DataPresenter([]).render({
          tableUserConfig: {
            columns: {
              1: {
                width: 100
              }
            }
          }
        });
        expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
      });
    });
  });
});
