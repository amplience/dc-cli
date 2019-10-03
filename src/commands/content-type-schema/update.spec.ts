import { builder, BuilderOptions, command, desc, handler } from './update';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { TableUserConfig } from 'table';
import axios from 'axios';
import DataPresenter from '../../view/data-presenter';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('axios');
jest.mock('../../view/data-presenter');

const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<ContentTypeSchema>>;

describe('content type schema update command', function() {
  const yargArgs = {
    $0: 'test',
    _: ['test']
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
  mockUpdate.mockResolvedValue({
    id: 'id'
  });

  it('should have a command', function() {
    expect(command).toEqual('update');
  });

  it('should have a description', function() {
    expect(desc).toEqual('Update Content Type Schema');
  });

  it('should have a builder that has an id option', function() {
    expect(builder.id).toEqual({
      type: 'string',
      demandOption: true,
      description: 'content-type-schema ID'
    });
  });

  it('should have a builder that has a schema option', function() {
    expect(builder.schema).toEqual({
      type: 'string',
      demandOption: true,
      description: 'content-type-schema Source Location'
    });
  });

  it('should have a builder that has a validation level option', function() {
    expect(builder.validationLevel).toEqual({
      type: 'string',
      choices: ['SLOT', 'CONTENT_TYPE', 'PARTIAL'],
      demandOption: true,
      description: 'content-type-schema Validation Level'
    });
  });

  async function successfulHandlerInvocation(
    input: BuilderOptions,
    beforeInvocation: Function = (): void => {},
    afterInvocation: Function = (): void => {}
  ): Promise<void> {
    const updateResponse = {
      id: 'id'
    };

    const argv = { ...yargArgs, ...config, ...input };

    beforeInvocation();
    await handler(argv);
    afterInvocation();

    expect(mockGet).toHaveBeenCalledWith(input.id);
    expect(mockUpdate).toHaveBeenCalled();
    const expectedUserConfig: TableUserConfig = {
      columns: {
        1: {
          width: 100
        }
      }
    };
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, updateResponse, expectedUserConfig);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalled();
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
