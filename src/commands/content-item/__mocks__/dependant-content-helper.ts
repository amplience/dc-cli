// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dependsOn(itemIds: string[]): any {
  return {
    links: itemIds.map(id => ({
      _meta: {
        schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link'
      },
      contentType: 'https://dev-solutions.s3.amazonaws.com/DynamicContentTypes/Accelerators/blog.json',
      id: id
    }))
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
