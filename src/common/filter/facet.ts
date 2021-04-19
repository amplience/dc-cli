import { ContentItem } from 'dc-management-sdk-js';
import { equalsOrRegex } from './filter';

interface FacetRange {
  start: string;
  end: string;
}

interface Facet {
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

export function applyFacet(items: ContentItem[], facetOrString: Facet | string): ContentItem[] {
  let facet: Facet;
  if (typeof facetOrString === 'string') {
    facet = parseFacet(facetOrString);
  } else {
    facet = facetOrString;
  }

  return items.filter(item => {
    if (facet.locale && !equalsOrRegex(item.locale, facet.locale)) return false;
    if (facet.name && !equalsOrRegex(item.label, facet.name)) return false;
    if (facet.schema && !equalsOrRegex(item.body._meta.schemaId, facet.schema)) return false;
    if (facet.status && !equalsOrRegex(item.status, facet.status)) return false;

    // Date range checks.
    if (facet.lastModifiedDate && !dateRangeMatch(item.lastModifiedDate, facet.lastModifiedDate)) return false;

    return true;
  });
}
