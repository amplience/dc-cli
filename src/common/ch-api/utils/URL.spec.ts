import { combineURLs, isAbsoluteURL } from './URL';

describe('URL tests', () => {
  test('combine url tests', () => {
    const relativeX2 = combineURLs('test', 'test2');

    expect(relativeX2).toEqual('test/test2');

    const absoluteX2 = combineURLs('http://absoluteUrl', 'http://absoluteUrl2');

    expect(absoluteX2).toEqual('http://absoluteUrl2');

    const absoluteRelative = combineURLs('http://absoluteUrl', 'test2');

    expect(absoluteRelative).toEqual('http://absoluteUrl/test2');

    const relativeAbsolute = combineURLs('test', 'http://absoluteUrl2');

    expect(relativeAbsolute).toEqual('http://absoluteUrl2');

    const absoluteNone = combineURLs('http://absoluteUrl', null);

    expect(absoluteNone).toEqual('http://absoluteUrl');
  });

  test('absolute url tests', () => {
    expect(isAbsoluteURL('http://absolute/a/b')).toBeTruthy();
    expect(isAbsoluteURL('https://absolute/a/b/')).toBeTruthy();
    expect(isAbsoluteURL('//absolute/a/b/c')).toBeTruthy();
    expect(isAbsoluteURL('//absolute')).toBeTruthy();

    expect(isAbsoluteURL('relative')).toBeFalsy();
    expect(isAbsoluteURL('relative.html')).toBeFalsy();
    expect(isAbsoluteURL('relative/a/b/c')).toBeFalsy();
    expect(isAbsoluteURL('relative/a/b/c/')).toBeFalsy();
    expect(isAbsoluteURL('/absolute/a/b/c')).toBeFalsy();
    expect(isAbsoluteURL('/absolute')).toBeFalsy();
  });
});
