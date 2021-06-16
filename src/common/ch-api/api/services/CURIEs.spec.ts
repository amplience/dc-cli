// tslint:disable:no-expression-statement
import { CURIEs } from './CURIEs';

describe('AxiosHttpClient tests', () => {
  test('should ignore query parameters that are not provided', () => {
    const href = CURIEs.expand('/resource{?page}', {});
    expect(href).toEqual('/resource');
  });

  test('should replace provided query parameters', () => {
    const href = CURIEs.expand('/resource{?page}', { page: 1 });
    expect(href).toEqual('/resource?page=1');
  });

  test('should replace multiple provided query parameters', () => {
    const href = CURIEs.expand('/resource{?page,size}', { page: 1, size: 10 });
    expect(href).toEqual('/resource?page=1&size=10');
  });

  test('should only include provided query parameters', () => {
    const href = CURIEs.expand('/resource{?page,size}', { page: 1 });
    expect(href).toEqual('/resource?page=1');
  });

  test('should encode query string parameters', () => {
    const href = CURIEs.expand('/resource{?page,size}', { page: '=' });
    expect(href).toEqual('/resource?page=%3D');
  });

  test('should replace path parameters', () => {
    const href = CURIEs.expand('/resource/{id}', { id: 1 });
    expect(href).toEqual('/resource/1');
  });

  test('should replace with empty value if required path parameters missing', () => {
    const href = CURIEs.expand('/resource/{id}', {});
    expect(href).toEqual('/resource/');
  });

  test('should default parameters', () => {
    const href = CURIEs.expand('/resource');
    expect(href).toEqual('/resource');
  });
});
