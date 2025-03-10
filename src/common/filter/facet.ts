import { ContentItem, FacetedContentItem } from 'dc-management-sdk-js';
import { equalsOrRegex } from './filter';
import { isRegexString, hasRegexSpecialCharacter, removeEscapes } from './regex';

interface FacetRange {
  start: string;
  end: string;
}

export interface Facet {
  locale?: string;
  name?: string;
  schema?: string;
  status?: string;
  lastModifiedDate?: FacetRange | DatePreset;
}

export type DatePreset = 'Last 7 days' | 'Last 14 days' | 'Last 30 days' | 'Last 60 days' | 'Over 60 days';

export function parseFacet(filter: string): Facet {
  // The format is rather simple:
  // "key:value, key:valueWith\,Comma, key:value:with:colon,"
  // Comma separated key value list. The first colon designates the end of the key. All commas must be escaped.
  // The space between list items is optional.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  let searchIndex = 0;

  while (searchIndex < filter.length) {
    const keyEnd = filter.indexOf(':', searchIndex);
    if (keyEnd == -1) break;

    const key = filter.substring(searchIndex, keyEnd).trimLeft();

    // Find value end, escape commas with backslash.

    let valueEnd = filter.length;
    let valueEndSearch = keyEnd;

    while (valueEndSearch < filter.length) {
      const potentialValueEnd = filter.indexOf(',', valueEndSearch);

      if (potentialValueEnd == -1) {
        break;
      } else if (filter[potentialValueEnd - 1] == '\\') {
        valueEndSearch = potentialValueEnd + 1;
      } else {
        valueEnd = potentialValueEnd;
        break;
      }
    }

    const value = filter.substring(keyEnd + 1, valueEnd).replace(/\\\,/g, ',');

    result[key] = value;

    searchIndex = valueEnd + 1;
  }

  return result as Facet;
}

export function parseDateRange(range: DatePreset | FacetRange): FacetRange {
  if (typeof range === 'string') {
    switch (range) {
      case 'Last 7 days':
        return { start: 'NOW', end: '-7:DAYS' };
      case 'Last 14 days':
        return { start: 'NOW', end: '-14:DAYS' };
      case 'Last 30 days':
        return { start: 'NOW', end: '-30:DAYS' };
      case 'Last 60 days':
        return { start: 'NOW', end: '-60:DAYS' };
      case 'Over 60 days':
        return { start: '-60:DAYS', end: '-100:YEARS' };
      default:
        throw new Error(`Unexpected date range string: ${range}`);
    }
  }

  return range;
}

export function relativeDate(relative: string): Date {
  if (relative === 'NOW') return new Date();

  const date = new Date();

  const split = relative.split(':');
  if (split.length != 2) {
    throw new Error(`Unexpected relative date format: ${relative}`);
  }

  const unit = split[1];
  switch (unit) {
    case 'DAYS':
      date.setDate(date.getDate() + Number(split[0]));
      return date;
    default:
      throw new Error(`Unexpected relative date units: ${unit}`);
  }
}

export function dateRangeMatch(dateString: string, range: DatePreset | FacetRange): boolean {
  const date = new Date(dateString);
  range = parseDateRange(range);

  const start = relativeDate(range.start);
  const end = relativeDate(range.end);

  const inverted = start > end;
  const lower = inverted ? end : start;
  const higher = inverted ? start : end;

  return date > lower && date <= higher;
}

export function tryGetArray(facetValue: string | undefined, onlyExact: boolean): string[] | null {
  if (facetValue == null) {
    return null;
  }

  if (isRegexString(facetValue)) {
    const regex = facetValue.substr(1, facetValue.length - 2);

    const split = regex.split(/((?:[^\\]|^)(?:\\\\)*)\|/);

    // Since js doesn't support regex lookback, merge together the [^\\] capture with the rest of each item
    for (let i = 0; i < split.length - 1; i++) {
      split[i] = split[i] + split[i + 1];
      split.splice(i + 1, 1);
    }

    const result: string[] = [];

    for (let item of split) {
      // Three cases:
      // Within ^$: exact match. The request we make to the facets endpoint may not be exact, but a followup filter can fix that.
      // Within (): converted regex.
      // None: user specified regex.

      if (item.length > 2) {
        const start = item[0];
        const end = item[item.length - 1];
        if ((start === '^' && end === '$') || (start === '(' && end === ')')) {
          if (onlyExact && start !== '^') {
            return null;
          }
          item = item.substr(1, item.length - 2);
        } else if (onlyExact) {
          return null;
        }
      } else if (onlyExact) {
        return null;
      }

      if (!hasRegexSpecialCharacter(item)) {
        item = removeEscapes(item);
      } else {
        return null; // Cannot be used.
      }

      result.push(item);
    }

    return result;
  }

  return [facetValue];
}

export function applyFacet(items: ContentItem[], facetOrString: Facet | string): ContentItem[] {
  let facet: Facet;
  if (typeof facetOrString === 'string') {
    facet = parseFacet(facetOrString);
  } else {
    facet = facetOrString;
  }

  return items.filter(item => {
    if (facet.locale && (!item.locale || !equalsOrRegex(item.locale, facet.locale))) return false;
    if (facet.name && !equalsOrRegex(item.label, facet.name)) return false;
    if (
      facet.schema &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !equalsOrRegex((item as any as FacetedContentItem).schema || item.body._meta.schema, facet.schema)
    )
      return false;
    if (facet.status && !equalsOrRegex(item.status, facet.status)) return false;

    // Date range checks.
    if (facet.lastModifiedDate && !dateRangeMatch(item.lastModifiedDate, facet.lastModifiedDate)) return false;

    return true;
  });
}

function escapeForRegex(url: string): string {
  return url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function combineFilters(filters: string[] | string): string {
  if (!Array.isArray(filters)) {
    return filters;
  }

  const regexElements = [];

  for (const filter of filters) {
    if (filter.length > 2 && filter[0] === '/' && filter[filter.length - 1] === '/') {
      regexElements.push(`(${filter.substr(1, filter.length - 2)})`);
    } else {
      regexElements.push(`^${escapeForRegex(filter)}$`);
    }
  }

  return `/${regexElements.join('|')}/`;
}

function getOldFilter(filters: string[] | string, name: string): string {
  return `${name}:${combineFilters(filters)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withOldFilters(facet: string | undefined, args: any): string | undefined {
  if (facet || !(args.name || args.schemaId)) {
    return facet;
  }

  const resultFilters: string[] = [];

  if (args.name) {
    resultFilters.push(getOldFilter(args.name, 'name'));
  }

  if (args.schemaId) {
    resultFilters.push(getOldFilter(args.schemaId, 'schema'));
  }

  return resultFilters.map(filter => filter.replace(/\,/g, '\\,')).join(',');
}
