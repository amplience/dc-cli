import { ContentDependancy } from '../../../common/content-item/content-dependancy-tree';

function dependancy(id: string): ContentDependancy {
  return {
    _meta: {
      schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
      name: 'content-link'
    },
    contentType: 'https://dev-solutions.s3.amazonaws.com/DynamicContentTypes/Accelerators/blog.json',
    id: id
  };
}

function dependProps(itemProps: [string, string][]): object {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  itemProps.forEach(element => {
    result[element[0]] = dependancy(element[1]);
  });
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dependsOn(itemIds: string[], itemProps?: [string, string][]): any {
  itemProps = itemProps || [];
  return {
    links: itemIds.map(id => dependancy(id)),
    ...dependProps(itemProps)
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dependantType(items: number): any {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'http://superbasic.com',

    title: 'Title',
    description: 'Description',

    allOf: [
      {
        $ref: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content'
      }
    ],

    required: ['valid'],
    type: 'object',
    properties: {
      links: {
        title: 'title',
        type: 'array',
        minItems: items,
        maxItems: items,
        items: {
          allOf: [
            { $ref: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
            {
              properties: {
                contentType: {
                  enum: ['*']
                }
              }
            }
          ]
        }
      }
    },
    propertyOrder: []
  };
}
