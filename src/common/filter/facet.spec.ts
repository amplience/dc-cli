import {
  applyFacet,
  parseFacet,
  dateRangeMatch,
  relativeDate,
  parseDateRange,
  DatePreset,
  withOldFilters,
  tryGetArray
} from './facet';
import { ContentItem } from 'dc-management-sdk-js';

describe('facet', () => {
  describe('parseFacet tests', () => {
    it('should parse an empty string as an empty facet', () => {
      expect(parseFacet('')).toEqual({});
    });

    it('should parse straightforward filters', () => {
      expect(parseFacet('locale:en-GB')).toEqual({ locale: 'en-GB' });
      expect(parseFacet('name:name with space')).toEqual({ name: 'name with space' });
      expect(parseFacet('name:name with space,status:ACTIVE')).toEqual({
        name: 'name with space',
        status: 'ACTIVE'
      });
      expect(parseFacet('name:space after commas, schema:test.json, lastModifiedDate:Last 7 days')).toEqual({
        name: 'space after commas',
        schema: 'test.json',
        lastModifiedDate: 'Last 7 days'
      });

      expect(parseFacet('name:/.endName$/, schema:/test.json$/, lastModifiedDate:Last 7 days')).toEqual({
        name: '/.endName$/',
        schema: '/test.json$/',
        lastModifiedDate: 'Last 7 days'
      });
    });

    it('should ignore a final key with no value', () => {
      expect(parseFacet('key')).toEqual({});
      expect(parseFacet('locale:en-GB, key')).toEqual({ locale: 'en-GB' });
    });

    it('should parse values with semicolons', () => {
      expect(parseFacet('name:name:with:colons')).toEqual({ name: 'name:with:colons' });
      expect(parseFacet('name:colon:name:,status:ACTIVE')).toEqual({ name: 'colon:name:', status: 'ACTIVE' });
      expect(parseFacet('name:/nameRegex*./, schema:http://example.com/test.json, status:ARCHIVED')).toEqual({
        name: '/nameRegex*./',
        schema: 'http://example.com/test.json',
        status: 'ARCHIVED'
      });
    });

    it('should parse empty values', () => {
      expect(parseFacet('name:')).toEqual({ name: '' });
      expect(parseFacet('name:,status:ACTIVE')).toEqual({ name: '', status: 'ACTIVE' });
    });

    it('should allow comma escapes', () => {
      expect(parseFacet('name:contains\\,comma,status:ARCHIVED')).toEqual({
        name: 'contains,comma',
        status: 'ARCHIVED'
      });
      expect(parseFacet('name:\\,,status:ACTIVE')).toEqual({ name: ',', status: 'ACTIVE' });
      expect(parseFacet('name:\\,\\,\\,,status:ACTIVE')).toEqual({ name: ',,,', status: 'ACTIVE' });
      expect(parseFacet('name:/regex\\,with\\,commas/,status:ACTIVE')).toEqual({
        name: '/regex,with,commas/',
        status: 'ACTIVE'
      });

      expect(parseFacet('name:/\\escapes\\in\\regex\\,but\\,not\\,commas\\\\,/,status:ACTIVE')).toEqual({
        name: '/\\escapes\\in\\regex,but,not,commas\\,/',
        status: 'ACTIVE'
      });
    });
  });

  describe('parseDateRange tests', () => {
    it('should return a given date range object', () => {
      expect(parseDateRange({ start: 'NOW', end: '-1:DAYS' })).toEqual({ start: 'NOW', end: '-1:DAYS' });
      expect(parseDateRange({ start: '-2:DAYS', end: '-32:DAYS' })).toEqual({ start: '-2:DAYS', end: '-32:DAYS' });
    });

    it('should parse from expected DC date range strings', () => {
      expect(parseDateRange('Last 7 days')).toEqual({ start: 'NOW', end: '-7:DAYS' });
      expect(parseDateRange('Last 14 days')).toEqual({ start: 'NOW', end: '-14:DAYS' });
      expect(parseDateRange('Last 30 days')).toEqual({ start: 'NOW', end: '-30:DAYS' });
      expect(parseDateRange('Last 60 days')).toEqual({ start: 'NOW', end: '-60:DAYS' });
      expect(parseDateRange('Over 60 days')).toEqual({ start: '-60:DAYS', end: '-100:YEARS' });
    });

    it('should throw when given a date range string that cannot be parsed', () => {
      expect(() => parseDateRange('Last 234 days' as unknown as DatePreset)).toThrowErrorMatchingInlineSnapshot(
        `"Unexpected date range string: Last 234 days"`
      );
      expect(() => parseDateRange('Not a date range' as unknown as DatePreset)).toThrowErrorMatchingInlineSnapshot(
        `"Unexpected date range string: Not a date range"`
      );
      expect(() => parseDateRange('2' as unknown as DatePreset)).toThrowErrorMatchingInlineSnapshot(
        `"Unexpected date range string: 2"`
      );
    });
  });

  describe('relativeDate tests', () => {
    const fakeDate = new Date('2021-04-15T12:00:00.000Z');
    const fakeDateM1 = new Date('2021-04-14T12:00:00.000Z');
    const fakeDateM5 = new Date('2021-04-10T12:00:00.000Z');
    const fakeDateP3 = new Date('2021-04-18T12:00:00.000Z');

    beforeAll(() => {
      const realDate = Date;
      jest.spyOn(global, 'Date').mockImplementation(() => new realDate(fakeDate));
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should return the current date if the value is NOW', () => {
      expect(relativeDate('NOW').getTime()).toEqual(fakeDate.getTime());
    });

    it('should return relative days given an input like #:DAYS', () => {
      expect(relativeDate('-1:DAYS').getTime()).toEqual(fakeDateM1.getTime());
      expect(relativeDate('-5:DAYS').getTime()).toEqual(fakeDateM5.getTime());
      expect(relativeDate('3:DAYS').getTime()).toEqual(fakeDateP3.getTime());
    });

    it('should throw when the input string does not have two values separated by a colon', () => {
      expect(() => relativeDate('NO COLON')).toThrowErrorMatchingInlineSnapshot(
        `"Unexpected relative date format: NO COLON"`
      );
      expect(() => relativeDate('TOO:MANY:COLONS')).toThrowErrorMatchingInlineSnapshot(
        `"Unexpected relative date format: TOO:MANY:COLONS"`
      );
    });

    it('should throw when the input units are unknown', () => {
      expect(() => relativeDate('3:BADUNIT')).toThrowErrorMatchingInlineSnapshot(
        `"Unexpected relative date units: BADUNIT"`
      );
      expect(() => relativeDate('-12:CENTURIES')).toThrowErrorMatchingInlineSnapshot(
        `"Unexpected relative date units: CENTURIES"`
      );
    });
  });

  describe('dateRangeMatch tests', () => {
    it('should return true if the given date is within the range', () => {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      expect(dateRangeMatch(date.toISOString(), { start: '-2:DAYS', end: 'NOW' })).toBeTruthy();
    });

    it('should return false if the given date is not within the range', () => {
      const date = new Date();
      date.setDate(date.getDate() - 3);
      expect(dateRangeMatch(date.toISOString(), { start: '-2:DAYS', end: 'NOW' })).toBeFalsy();

      const date2 = new Date();
      date2.setDate(date2.getDate() + 1);
      expect(dateRangeMatch(date2.toISOString(), { start: '-2:DAYS', end: 'NOW' })).toBeFalsy();
    });
  });

  const schemaContentItem = (schema: string, label?: string): ContentItem => {
    return new ContentItem({ body: { _meta: { schema } }, label });
  };

  describe('tryGetArray tests', () => {
    it('should return null if the facet is undefined', () => {
      expect(tryGetArray(undefined, false)).toBeNull();
    });

    it('should return the input wrapped in an array if not given a regex value', () => {
      expect(tryGetArray('regular text', false)).toEqual(['regular text']);
      expect(tryGetArray('\\!@£$%^&*(){}[]/', false)).toEqual(['\\!@£$%^&*(){}[]/']);
    });

    it('should return null if the provided regex is not in an exact match format, and exactMatch is true', () => {
      expect(tryGetArray('/inexact/', true)).toBeNull();
      expect(tryGetArray('/(inexact)/', true)).toBeNull();
      expect(tryGetArray('/a/', true)).toBeNull();

      expect(tryGetArray('/^test1$|test2/', true)).toBeNull();
      expect(tryGetArray('/^test1$|(test2)/', true)).toBeNull();
    });

    it('should match expected regex patterns and extract arrays from them', () => {
      expect(tryGetArray('/^exact$/', false)).toEqual(['exact']);
      expect(tryGetArray('/(inexact1)/', false)).toEqual(['inexact1']);
      expect(tryGetArray('/inexact2/', false)).toEqual(['inexact2']);

      expect(tryGetArray('/^item1$|^item2$|^item3$/', true)).toEqual(['item1', 'item2', 'item3']);
      expect(tryGetArray('/(inex1)|(inex2)|(inex3)/', false)).toEqual(['inex1', 'inex2', 'inex3']);
      expect(tryGetArray('/test1|test2|test3/', false)).toEqual(['test1', 'test2', 'test3']);

      expect(tryGetArray('/test1|^test2$|(test3)/', false)).toEqual(['test1', 'test2', 'test3']);

      expect(tryGetArray('/\\*escaped\\/specials\\[|two\\$test/', false)).toEqual(['*escaped/specials[', 'two$test']);
    });

    it('should return null if regex special characters are used without escapes', () => {
      expect(tryGetArray('/regex*/', false)).toBeNull();
      expect(tryGetArray('/[]/', false)).toBeNull();
      expect(tryGetArray('/fine|not?fine/', false)).toBeNull();
    });

    it('should split only on unescaped pipe character', () => {
      expect(tryGetArray('/simple|split|regex/', false)).toEqual(['simple', 'split', 'regex']);
      expect(tryGetArray('/sim\\|ple|spl\\|it|reg\\|ex/', false)).toEqual(['sim|ple', 'spl|it', 'reg|ex']);
      expect(tryGetArray('/doubleEscape\\\\|split/', false)).toEqual(['doubleEscape\\', 'split']);
      expect(tryGetArray('/tripleEscape\\\\\\|split/', false)).toEqual(['tripleEscape\\|split']);
    });
  });

  describe('applyFilter tests', () => {
    const fakeDate = new Date('2021-04-15T12:00:00.000Z');
    const fakeDateM1 = '2021-04-14T12:00:00.000Z';
    const fakeDateM10 = '2021-04-05T12:00:00.000Z';

    beforeAll(() => {
      const realDate = Date;
      jest.spyOn(global, 'Date').mockImplementation(date => new realDate(date || fakeDate));
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should filter content items based on the provided facet', () => {
      const itemsLabel = [new ContentItem({ label: 'example' }), new ContentItem({ label: 'example2' })];
      expect(applyFacet(itemsLabel, { name: 'example' })).toEqual([itemsLabel[0]]);

      const itemsSchema = [schemaContentItem('http://schemaMiss.json'), schemaContentItem('http://schemaHit.json')];
      expect(applyFacet(itemsSchema, { schema: 'http://schemaHit.json' })).toEqual([itemsSchema[1]]);

      const itemsLocale = [new ContentItem({ locale: 'en-GB' }), new ContentItem({ locale: 'en-US' })];
      expect(applyFacet(itemsLocale, { locale: 'en-GB' })).toEqual([itemsLocale[0]]);

      const itemsStatus = [new ContentItem({ status: 'ACTIVE' }), new ContentItem({ status: 'ARCHIVED' })];
      expect(applyFacet(itemsStatus, { status: 'ARCHIVED' })).toEqual([itemsStatus[1]]);

      const itemsDate = [
        new ContentItem({ lastModifiedDate: fakeDateM1 }),
        new ContentItem({ lastModifiedDate: fakeDateM10 })
      ];
      expect(applyFacet(itemsDate, { lastModifiedDate: 'Last 7 days' })).toEqual([itemsDate[0]]);
    });

    it('should filter content items by regex based on the provided facet', () => {
      const itemsLabel = [
        new ContentItem({ label: 'example' }),
        new ContentItem({ label: 'example2' }),
        new ContentItem({ label: 'other' })
      ];
      expect(applyFacet(itemsLabel, { name: '/example/' })).toEqual([itemsLabel[0], itemsLabel[1]]);

      const itemsSchema = [
        schemaContentItem('http://schemaMiss.json'),
        schemaContentItem('http://differentMiss.json'),
        schemaContentItem('http://schemaHit.json')
      ];
      expect(applyFacet(itemsSchema, { schema: '/^http://schema.*\\.json$/' })).toEqual([
        itemsSchema[0],
        itemsSchema[2]
      ]);

      const itemsLocale = [
        new ContentItem({ locale: 'fr-FR' }),
        new ContentItem({ locale: 'en-GB' }),
        new ContentItem({ locale: 'en-US' })
      ];
      expect(applyFacet(itemsLocale, { locale: '/^en\\-/' })).toEqual([itemsLocale[1], itemsLocale[2]]);
    });

    it('should combine multiple filters', () => {
      const itemsSchema = [
        schemaContentItem('http://schemaMiss.json', 'incorrectName'),
        schemaContentItem('http://schemaHit.json', 'correctName'),
        schemaContentItem('http://differentMiss.json', 'correctName')
      ];
      expect(applyFacet(itemsSchema, { name: 'correctName', schema: '/^http://schema.*\\.json$/' })).toEqual([
        itemsSchema[1]
      ]);
    });

    it('should convert the facet from a string if a string is provided', () => {
      const items = [new ContentItem({ label: 'example' }), new ContentItem({ label: 'example2' })];

      expect(applyFacet(items, 'name:example')).toEqual([items[0]]);
    });
  });

  describe('withOldFilters tests', () => {
    it('should return facets if present', () => {
      expect(withOldFilters('oldFacet', {})).toEqual('oldFacet');
    });

    it('should return undefined if no facets or args are present', () => {
      expect(withOldFilters(undefined, {})).toBeUndefined();
    });

    it('should return single values directly', () => {
      expect(withOldFilters(undefined, { name: 'testSearch' })).toEqual('name:testSearch');
      expect(withOldFilters(undefined, { schemaId: 'testSearch' })).toEqual('schema:testSearch');
      expect(withOldFilters(undefined, { name: 'testSearch', schemaId: 'testSearch2' })).toEqual(
        'name:testSearch,schema:testSearch2'
      );

      expect(withOldFilters(undefined, { name: '/regex/' })).toEqual('name:/regex/');
      expect(withOldFilters(undefined, { schemaId: '/regex/' })).toEqual('schema:/regex/');
      expect(withOldFilters(undefined, { name: '/regex/', schemaId: '/regex2/' })).toEqual(
        'name:/regex/,schema:/regex2/'
      );
    });

    it('should combine values and regexes', () => {
      expect(withOldFilters(undefined, { name: ['one', 'two'] })).toEqual('name:/^one$|^two$/');
      expect(withOldFilters(undefined, { schemaId: ['one', 'two', 'three'] })).toEqual('schema:/^one$|^two$|^three$/');

      expect(withOldFilters(undefined, { name: ['/regex/', '/regex2/'] })).toEqual('name:/(regex)|(regex2)/');
      expect(withOldFilters(undefined, { schemaId: ['/regex/', '/regex2/', '/regex3/'] })).toEqual(
        'schema:/(regex)|(regex2)|(regex3)/'
      );
    });

    it('should escape regex characters when combining names into one', () => {
      expect(withOldFilters(undefined, { name: ['reserved.characters*', 'd.(to)'] })).toEqual(
        'name:/^reserved\\.characters\\*$|^d\\.\\(to\\)$/'
      );
    });

    it('should escape commas', () => {
      expect(withOldFilters(undefined, { name: 'test,Search' })).toEqual('name:test\\,Search');
      expect(withOldFilters(undefined, { schemaId: 'test,Search' })).toEqual('schema:test\\,Search');
      expect(withOldFilters(undefined, { name: 'test,Search', schemaId: 'test,Search2' })).toEqual(
        'name:test\\,Search,schema:test\\,Search2'
      );

      expect(withOldFilters(undefined, { name: '/reg,ex/' })).toEqual('name:/reg\\,ex/');
      expect(withOldFilters(undefined, { schemaId: '/reg,ex/' })).toEqual('schema:/reg\\,ex/');
      expect(withOldFilters(undefined, { name: '/reg,ex/', schemaId: '/reg,ex2/' })).toEqual(
        'name:/reg\\,ex/,schema:/reg\\,ex2/'
      );
    });
  });
});
