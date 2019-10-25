import { transformYargObjectToArray } from './yargs-object-transformer';

describe('transformYargObjectToArray', () => {
  it('should convert a YargsObject to an array of objects', () => {
    const yargsObject = {
      0: {
        propertyOne: 'property-one-value'
      }
    };

    const result = transformYargObjectToArray(yargsObject);

    expect(result).toEqual([{ propertyOne: 'property-one-value' }]);
  });

  it('should convert a YargsObject to an array of objects and sort by key', () => {
    const yargsObject = {
      1: {
        propertyTwo: 'property-two-value'
      },
      3: {
        propertyFour: 'property-four-value'
      },
      0: {
        propertyOne: 'property-one-value'
      },
      2: {
        propertyThree: 'property-three-value'
      }
    };

    const result = transformYargObjectToArray(yargsObject);

    expect(result).toEqual([
      { propertyOne: 'property-one-value' },
      { propertyTwo: 'property-two-value' },
      { propertyThree: 'property-three-value' },
      { propertyFour: 'property-four-value' }
    ]);
  });

  it('should throw an error when the index of the object does not start at 0', () => {
    const yargsObject = {
      1: {
        propertyOne: 'property-one-value'
      }
    };

    expect(() => transformYargObjectToArray(yargsObject)).toThrowError(
      new Error('Targeted array indexes are unsupported, please provide a full array index starting at 0')
    );
  });

  it('should not throw an error when no array items are supplied', () => {
    const yargsObject = {};

    const result = transformYargObjectToArray(yargsObject);

    expect(result).toEqual([]);
  });
});
