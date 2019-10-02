import { builder, BuilderOptions, command, desc, handler } from './create';
import { ContentTypeSchema, ValidationLevel } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { TableUserConfig } from 'table';
import axios from 'axios';
import DataPresenter from '../../view/data-presenter';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('axios');
jest.mock('../../view/data-presenter');

const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter<ContentTypeSchema>>;

describe('content type schema create command', function() {
  const yargArgs = {
    $0: 'test',
    _: ['test']
  };
  const config = {
    clientId: 'client-id',
    clientSecret: 'client-id',
    hubId: 'hub-id'
  };

  const mockGetHub = jest.fn();
  (dynamicContentClientFactory as jest.Mock).mockReturnValue({
    hubs: {
      get: mockGetHub
    }
  });

  it('should have a command', function() {
    expect(command).toEqual('create');
  });

  it('should have a description', function() {
    expect(desc).toEqual('Create Content Type Schema');
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
    const createResponse = { id: 'test' };
    const mockCreate = jest.fn();
    mockGetHub.mockResolvedValue({ related: { contentTypeSchema: { create: mockCreate } } });
    mockCreate.mockResolvedValue(createResponse);

    const argv = { ...yargArgs, ...config, ...input };

    beforeInvocation();
    await handler(argv);
    afterInvocation();

    expect(mockGetHub).toHaveBeenCalledWith(config.hubId);
    expect(mockCreate).toHaveBeenCalled();
    const expectedUserConfig: TableUserConfig = {
      columns: {
        1: {
          width: 100
        }
      }
    };
    expect(mockDataPresenter).toHaveBeenCalledWith(argv, createResponse, expectedUserConfig);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalled();
  }

  it('should load a schema from a local file (relative path)', async function() {
    const input = {
      schema: __dirname + '/__fixtures/schema.json',
      validationLevel: ValidationLevel.CONTENT_TYPE
    };
    await successfulHandlerInvocation(input);
  });

  it('should load a schema from a local file (with file url)', async function() {
    const input = {
      schema: 'file://' + __dirname + '/__fixtures/schema.json',
      validationLevel: ValidationLevel.CONTENT_TYPE
    };
    await successfulHandlerInvocation(input);
  });

  async function successfulHandlerAxiosInvocation(input: BuilderOptions): Promise<void> {
    const mockAxiosGet = axios.get as jest.Mock;
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

  it('should load a schema from a url (http)', async function() {
    const input = {
      schema: 'http://example.com/schema.json',
      validationLevel: ValidationLevel.CONTENT_TYPE
    };

    await successfulHandlerAxiosInvocation(input);
  });

  it('should load a schema from a url (https)', async function() {
    const input = {
      schema: 'https://example.com/schema.json',
      validationLevel: ValidationLevel.CONTENT_TYPE
    };

    await successfulHandlerAxiosInvocation(input);
  });
});
