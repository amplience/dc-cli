import { isPlainObject } from 'lodash';
import { Body } from './body';

const referenceTypes = ['http://bigcontent.io/cms/schema/v1/core#/definitions/content-link'];

const isContentDependancy = (content: Body) => {
  return (
    referenceTypes.includes(content?._meta?.schema) &&
    typeof content?.contentType === 'string' &&
    typeof content?.id === 'string'
  );
};

export const findContentDependancyIds = (content: Body): string[] => {
  if (Array.isArray(content)) {
    return content.reduce((ids, item) => [...ids, ...findContentDependancyIds(item)], []);
  }

  if (isPlainObject(content)) {
    return Object.values(content || {}).reduce(
      (ids, prop) => {
        if (isPlainObject(prop) || Array.isArray(prop)) {
          return [...ids, ...findContentDependancyIds(prop)];
        }
        return [...ids];
      },
      [...(isContentDependancy(content) ? [content.id] : [])]
    );
  }

  return [];
};
