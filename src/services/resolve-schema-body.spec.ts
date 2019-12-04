import { resolveSchemaBody } from './resolve-schema-body';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import { jsonResolver } from '../common/json-resolver/json-resolver';

jest.mock('../common/json-resolver/json-resolver');

describe('resolveSchemaBody', () => {
  it('should allow undefined body', async () => {
    const schemas = { 'filename.json': new ContentTypeSchema() };
    const [result, errors] = await resolveSchemaBody(schemas, __dirname);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "filename.json": Object {},
      }
    `);
    expect(errors).toMatchInlineSnapshot(`Object {}`);
  });

  it('should resolve body as string', async () => {
    const stringifiedBody = JSON.stringify('{"prop": 123}');
    const mockJsonResolver = jsonResolver as jest.Mock;
    mockJsonResolver.mockResolvedValueOnce(stringifiedBody);
    const schemas = { 'filename.json': new ContentTypeSchema({ body: 'filename.json' }) };
    const [result, errors] = await resolveSchemaBody(schemas, __dirname);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "filename.json": Object {
          "body": "\\"{\\\\\\"prop\\\\\\": 123}\\"",
        },
      }
    `);
    expect(errors).toMatchInlineSnapshot(`Object {}`);
  });

  it('should return back an error when it cannot resolve', async () => {
    const mockJsonResolver = jsonResolver as jest.Mock;
    mockJsonResolver.mockRejectedValueOnce(new Error('File not found'));
    const schemas = { 'filename.json': new ContentTypeSchema({ body: 'filename.json' }) };
    const [result, errors] = await resolveSchemaBody(schemas, __dirname);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "filename.json": Object {
          "body": "filename.json",
        },
      }
    `);
    expect(errors).toMatchInlineSnapshot(`
      Object {
        "filename.json": [Error: File not found],
      }
    `);
  });
});
