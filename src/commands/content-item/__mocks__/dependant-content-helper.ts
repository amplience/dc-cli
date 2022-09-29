import { ContentDependancy, DependancyContentTypeSchema } from '../../../common/content-item/content-dependancy-tree';

function dependancy(
  id: string,
  type = 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link'
): ContentDependancy {
  return {
    _meta: {
      schema: type as DependancyContentTypeSchema,
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
export function dependsOn(itemIds: string[], type?: string, itemProps?: [string, string][]): any {
  itemProps = itemProps || [];
  return {
    links: itemIds.map(id => dependancy(id, type)),
    ...dependProps(itemProps)
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hierarchyParent(parentId: string, itemProps?: [string, string][]): any {
  itemProps = itemProps || [];
  const item = {
    ...dependProps(itemProps)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  if (!item._meta) {
    item._meta = {};
  }

  if (!item._meta.hierarchy) {
    item._meta.hierarchy = {};
  }

  item._meta.hierarchy.parentId = parentId;

  return item;
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
