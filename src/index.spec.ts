import helloWorld from './index';

describe('helloWorld function', (): void => {
  it('should return Hello World', (): void => {
    const result = helloWorld('World');
    expect(result).toEqual('Hello World');
  });
});
