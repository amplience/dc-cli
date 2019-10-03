import DataPresenter from './data-presenter';

const stdoutWriteSpy = jest.spyOn(process.stdout, 'write');

describe('DataPresenter', (): void => {
  const argv = {
    $0: 'test',
    _: ['test'],
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id'
  };

  beforeAll(() => {
    stdoutWriteSpy.mockImplementation(() => true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should render a vertical table', (): void => {
    const data = {
      toJSON: (): { [key: string]: string } => ({
        foo: 'bar',
        key: 'value'
      })
    };
    new DataPresenter(argv, data).render();
    expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
  });

  it('should render a horizontal table', (): void => {
    const data = {
      toJSON: (): { [key: string]: string }[] => [
        {
          foo: 'bar',
          key: 'value'
        }
      ]
    };
    new DataPresenter(argv, data).render();
    expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
  });

  it('should render a horizontal table with some page information', (): void => {
    const data = {
      toJSON: (): { [key: string]: string }[] => [
        {
          foo: 'bar',
          key: 'value'
        }
      ],
      page: {
        number: 0,
        totalPages: 20
      }
    };
    new DataPresenter(argv, data).render();
    expect(stdoutWriteSpy.mock.calls[1][0]).toMatchSnapshot();
  });

  it('should render some json', (): void => {
    const data = {
      toJSON: (): { [key: string]: string } => ({
        foo: 'bar',
        key: 'value'
      })
    };
    new DataPresenter({ ...argv, json: true }, data).render();
    expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
  });

  it('should parse some data', (): void => {
    const data = {
      foo: 'bar',
      key: 'value'
    };

    new DataPresenter(argv, { ...data, toJSON: (): { [key: string]: string } => data })
      .parse(({ foo }): { [key: string]: string } => ({ foo }))
      .render();
    expect(stdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
  });
});
