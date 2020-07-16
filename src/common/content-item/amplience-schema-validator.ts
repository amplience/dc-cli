import Ajv from 'ajv';
import { ContentTypeSchema } from 'dc-management-sdk-js';
import fetch from 'node-fetch';

export class AmplienceSchemaValidator {
  private ajv: Ajv.Ajv;
  private cache: Map<string, PromiseLike<Ajv.ValidateFunction>>;

  constructor(private schemas: ContentTypeSchema[]) {
    const loadSchema = async (uri: string): Promise<object | boolean> => {
      const internal = schemas.find(schema => schema.schemaId == uri);

      if (internal !== undefined) {
        return JSON.parse(internal.body as string);
      }

      try {
        return await (await fetch(uri)).json();
      } catch {
        return false;
      }
    };

    const ajv = new Ajv({ loadSchema, unknownFormats: ['symbol', 'color', 'markdown', 'text'], schemaId: 'auto' });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const draft4 = require('ajv/lib/refs/json-schema-draft-04.json');

    ajv.addMetaSchema(draft4);
    ajv.addMetaSchema(draft4, 'http://bigcontent.io/cms/schema/v1/schema.json');

    this.ajv = ajv;
    this.cache = new Map();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getValidatorCached(body: any): PromiseLike<Ajv.ValidateFunction> {
    const schemaId = body._meta.schema;

    const cacheResult = this.cache.get(schemaId);
    if (cacheResult != null) {
      return cacheResult;
    }

    const schema = this.schemas.find(schema => schema.schemaId === schemaId);
    if (schema != null) {
      const validator = this.ajv.compileAsync(JSON.parse(schema.body as string));
      this.cache.set(schemaId, validator);

      return validator;
    } else {
      const validator = (async (): Promise<Ajv.ValidateFunction> => {
        const schema = await (await fetch(schemaId)).json();

        return await this.ajv.compileAsync(schema);
      })();

      this.cache.set(schemaId, validator);
      return validator;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async validate(body: any): Promise<boolean> {
    const validator = await this.getValidatorCached(body);
    return validator(body);
  }
}
