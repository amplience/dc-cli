import Ajv, { ErrorObject } from 'ajv';
import { ContentTypeSchema, ContentType, CachedSchema } from 'dc-management-sdk-js';
import { Body } from './body';
import fetch from 'node-fetch';

export function defaultSchemaLookup(types: ContentType[], schemas: ContentTypeSchema[]) {
  return async (uri: string): Promise<ContentTypeSchema | undefined> => {
    const type = types.find(x => x.contentTypeUri === uri);
    let schema: ContentTypeSchema | undefined;

    if (type !== undefined) {
      try {
        const cached = (await type.related.contentTypeSchema.get()).cachedSchema as CachedSchema;

        schema = new ContentTypeSchema({
          body: JSON.stringify(cached),
          schemaId: cached.id
        });
      } catch {
        // Cached schema could not be retrieved, try fetch it from the schema list.
      }
    }

    if (schema === undefined) {
      schema = schemas.find(x => x.schemaId === uri);
    }

    return schema;
  };
}

export class AmplienceSchemaValidator {
  private ajv: Ajv.Ajv;
  private cache: Map<string, PromiseLike<Ajv.ValidateFunction>>;
  private schemas: ContentTypeSchema[] = [];

  constructor(private schemaLookup: (uri: string) => Promise<ContentTypeSchema | undefined>) {
    const ajv = new Ajv({
      loadSchema: this.loadSchema.bind(this),
      unknownFormats: ['symbol', 'color', 'markdown', 'text'],
      schemaId: 'auto'
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const draft4 = require('ajv/lib/refs/json-schema-draft-04.json');

    ajv.addMetaSchema(draft4);
    ajv.addMetaSchema(draft4, 'http://bigcontent.io/cms/schema/v1/schema.json');

    this.ajv = ajv;
    this.cache = new Map();
  }

  private loadSchema = async (uri: string): Promise<object | boolean> => {
    let internal = this.schemas.find(schema => schema.schemaId == uri);

    if (internal !== undefined) {
      return JSON.parse(internal.body as string);
    }

    internal = await this.schemaLookup(uri);
    let body: object;

    if (internal === undefined) {
      try {
        const result = await (await fetch(uri)).text();
        body = JSON.parse(result.trim());
      } catch (e) {
        return false;
      }
    } else {
      body = JSON.parse(internal.body as string);

      this.schemas.push(internal);
    }

    return body;
  };

  private getValidatorCached(body: Body): PromiseLike<Ajv.ValidateFunction> {
    const schemaId = body._meta.schema;

    const cacheResult = this.cache.get(schemaId);
    if (cacheResult != null) {
      return cacheResult;
    }

    const validator = (async (): Promise<Ajv.ValidateFunction> => {
      const schema = await this.loadSchema(schemaId);

      if (schema) {
        return await this.ajv.compileAsync(schema);
      } else {
        throw new Error('Could not find Content Type Schema!');
      }
    })();

    this.cache.set(schemaId, validator);
    return validator;
  }

  public async validate(body: Body): Promise<ErrorObject[]> {
    const validator = await this.getValidatorCached(body);
    const result = validator(body);
    return result ? [] : validator.errors || [];
  }
}
