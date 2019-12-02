import { builder, command, desc, handler } from './create';
import { ContentTypeSchema, Hub, ValidationLevel } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import DataPresenter from '../../view/data-presenter';
import { singleItemTableOptions } from '../../common/table/table.consts';
import { jsonResolver } from '../../common/json-resolver/json-resolver';
import { createContentTypeSchema } from './create.service';

jest.mock('../../services/dynamic-content-client-factory');
jest.mock('../../view/data-presenter');
jest.mock('../../common/json-resolver/json-resolver');
jest.mock('./create.service');

const mockDataPresenter = DataPresenter as jest.Mock<DataPresenter>;

describe('content type schema create command', function() {
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

  const mockGetHub = jest.fn();
  (dynamicContentClientFactory as jest.Mock).mockReturnValue({
    hubs: {
      get: mockGetHub
    }
  });
  const aHub = new Hub();
  mockGetHub.mockResolvedValue(aHub);

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
      description: 'content-type-schema Source Location',
      requiresArg: true
    });
  });

  it('should have a builder that has a validation level option', function() {
    expect(builder.validationLevel).toEqual({
      type: 'string',
      choices: ['SLOT', 'CONTENT_TYPE', 'PARTIAL'],
      demandOption: true,
      description: 'content-type-schema Validation Level',
      requiresArg: true
    });
  });

  it('should create a schema', async function() {
    const input = {
      schema: __dirname + '/__fixtures/schema.json',
      validationLevel: ValidationLevel.CONTENT_TYPE
    };
    const contentTypeSchema = { id: 'test' };

    (jsonResolver as jest.Mock).mockResolvedValue(JSON.stringify(contentTypeSchema));
    (createContentTypeSchema as jest.Mock).mockResolvedValue(new ContentTypeSchema(contentTypeSchema));

    const argv = { ...yargArgs, ...config, ...input };

    await handler(argv);

    expect(mockGetHub).toHaveBeenCalledWith(config.hubId);
    expect(jsonResolver).toHaveBeenCalledWith(input.schema);
    expect(createContentTypeSchema).toHaveBeenCalledWith(
      JSON.stringify(contentTypeSchema),
      input.validationLevel as ValidationLevel,
      aHub
    );

    expect(mockDataPresenter).toHaveBeenCalledWith(contentTypeSchema);
    expect(mockDataPresenter.mock.instances[0].render).toHaveBeenCalledWith({
      json: argv.json,
      tableUserConfig: singleItemTableOptions
    });
  });
});
