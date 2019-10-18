import { builder, command, desc, handler } from './update';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
import Yargs from 'yargs/yargs';
import { singleItemTableOptions } from '../../common/table/table.consts';
import { getExternalJson } from '../../common/import/external-json';
import { updateContentTypeSchema } from './update.service';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('./update.service');
jest.mock('../../common/import/external-json');

const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

describe('content type schema update command', function() {
  describe('command tests', function() {
    it('should have a command', function() {
      expect(command).toEqual('update [id]');
    });
  });

  describe('description tests', function() {
    it('should have a description', function() {
      expect(desc).toEqual('Update Content Type Schema');
    });
  });

  describe('builder tests', function() {
    it('should configure yargs', function() {
      const argv = Yargs(process.argv.slice(2));
      const spyPositional = jest.spyOn(argv, 'positional').mockReturnThis();
      const spyOptions = jest.spyOn(argv, 'options').mockReturnThis();

      builder(argv);

      expect(spyPositional).toHaveBeenCalledWith('id', {
        demandOption: true,
        describe: 'Content Type Schema ID',
        type: 'string'
      });
      expect(spyOptions).toHaveBeenCalledWith({
        schema: {
          type: 'string',
          demandOption: true,
          description: 'Content Type Schema Source Location'
        },
        validationLevel: {
          type: 'string',
          choices: ['SLOT', 'CONTENT_TYPE', 'PARTIAL'],
          demandOption: true,
          description: 'Content Type Schema Validation Level'
        },
        ...RenderingOptions
      });
    });
  });

  describe('handler tests', function() {
    const yargArgs = {
      $0: 'test',
      _: ['test'],
      json: true
    };
    const config = {
      clientId: 'client-id',
      clientSecret: 'client-id',
      hubId: 'hub-id'
    };

    const mockGet = jest.fn();
    const schemaBody = {
      id: 'content-type-schema-id',
      title: 'original'
    };
    const contentItemSchema = new ContentTypeSchema({ body: schemaBody });
    mockGet.mockResolvedValue(contentItemSchema);

    const mutatedSchemaBody = {
      id: 'content-type-schema-id',
      title: 'mutated'
    };
    (getExternalJson as jest.Mock).mockResolvedValue(JSON.stringify(mutatedSchemaBody));
    (updateContentTypeSchema as jest.Mock).mockResolvedValue(new ContentTypeSchema({ body: mutatedSchemaBody }));

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      contentTypeSchemas: {
        get: mockGet
      }
    });

    it('should update a schema', async function() {
      const argv = {
        ...yargArgs,
        ...config,
        id: 'id',
        schema: __dirname + '/__fixtures/schema.json',
        validationLevel: ValidationLevel.CONTENT_TYPE
      };

      await handler(argv);

      expect(mockGet).toHaveBeenCalledWith(argv.id);
      expect(getExternalJson).toHaveBeenCalledWith(argv.schema);
      expect(updateContentTypeSchema).toHaveBeenCalledWith(
        contentItemSchema,
        JSON.stringify(mutatedSchemaBody),
        argv.validationLevel
      );
      expect(mockDataPresenter).toHaveBeenCalledWith({ body: mutatedSchemaBody });
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
        json: argv.json,
        tableUserConfig: singleItemTableOptions
      });
    });
  });
});
