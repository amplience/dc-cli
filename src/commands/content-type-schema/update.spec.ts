import { builder, BuilderOptions, command, desc, handler } from './update';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import axios from 'axios';
import DataPresenter, { RenderingOptions } from '../../view/data-presenter';
import Yargs from 'yargs/yargs';
import { singleItemTableOptions } from '../../common/table/table.consts';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('axios');
jest.mock('../../view/data-presenter');

const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

describe('content type schema update command', function() {
  describe('command tests', function() {
    it('should have a command', function() {
      expect(command).toEqual('update <id>');
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
        describe: 'Content Type Schema ID',
        type: 'string'
      });
      expect(spyOptions).toHaveBeenCalledWith({
        schema: {
          type: 'string',
          demandOption: true,
          description: 'Content Type Schema Source Location',
          requiresArg: true
        },
        validationLevel: {
          type: 'string',
          choices: ['SLOT', 'CONTENT_TYPE', 'PARTIAL'],
          demandOption: true,
          description: 'Content Type Schema Validation Level',
          requiresArg: true
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
    const mockUpdate = jest.fn();
    const contentItemSchema = {
      id: 'content-type-schema-id',
      related: {
        update: mockUpdate
      }
    };
    mockGet.mockResolvedValue(contentItemSchema);

    (dynamicContentClientFactory as jest.Mock).mockReturnValue({
      contentTypeSchema: {
        related: {
          update: mockUpdate
        }
      },
      contentTypeSchemas: {
        get: mockGet
      }
    });
    const plainListContentTypeSchema = {
      id: 'id'
    };
    mockUpdate.mockResolvedValue(new ContentTypeSchema(plainListContentTypeSchema));

    async function successfulHandlerInvocation(
      input: BuilderOptions,
      beforeInvocation: Function = (): void => {},
      afterInvocation: Function = (): void => {}
    ): Promise<void> {
      const argv = { ...yargArgs, ...config, ...input };

      beforeInvocation();
      await handler(argv);
      afterInvocation();

      expect(mockGet).toHaveBeenCalledWith(input.id);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockDataPresenter).toHaveBeenCalledWith(plainListContentTypeSchema);
      expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
        json: argv.json,
        tableUserConfig: singleItemTableOptions
      });
    }

    it('should update a schema from a local file (relative path)', async function() {
      const input = {
        id: 'id',
        schema: __dirname + '/__fixtures/schema.json',
        validationLevel: ValidationLevel.CONTENT_TYPE
      };
      await successfulHandlerInvocation(input);
    });

    it('should update a schema from a local file (with file url)', async function() {
      const input = {
        id: 'id',
        schema: 'file://' + __dirname + '/__fixtures/schema.json',
        validationLevel: ValidationLevel.CONTENT_TYPE
      };
      await successfulHandlerInvocation(input);
    });

    async function successfulHandlerAxiosInvocation(input: BuilderOptions): Promise<void> {
      const mockAxiosGet = (axios.get as jest.Mock).mockReturnValueOnce({
        data: {
          $schema: 'test',
          id: 'test'
        }
      });
      await successfulHandlerInvocation(
        input,
        () => {
          mockAxiosGet.mockResolvedValue({
            data: {
              $schema: 'test',
              id: 'test'
            }
          });
        },
        () => {
          expect(mockAxiosGet).toHaveBeenCalled();
        }
      );
    }

    it('should update a schema from a url (http)', async function() {
      const input = {
        id: 'id',
        schema: 'http://example.com/schema.json',
        validationLevel: ValidationLevel.CONTENT_TYPE
      };

      await successfulHandlerAxiosInvocation(input);
    });

    it('should update a schema from a url (https)', async function() {
      const input = {
        id: 'id',
        schema: 'https://example.com/schema.json',
        validationLevel: ValidationLevel.CONTENT_TYPE
      };

      await successfulHandlerAxiosInvocation(input);
    });

    async function unSuccessfulHandlerInvocation(input: BuilderOptions, expectedError: string): Promise<void> {
      const argv = { ...yargArgs, ...config, ...input };
      await expect(handler(argv)).rejects.toThrowError(expectedError);
    }

    it('should failed to load schema with missing id', async function() {
      const input = {
        id: 'id',
        schema: 'file://' + __dirname + '/__fixtures/invalid_schema.json',
        validationLevel: ValidationLevel.CONTENT_TYPE
      };

      await unSuccessfulHandlerInvocation(input, 'Missing id from schema');
    });
  });
});
