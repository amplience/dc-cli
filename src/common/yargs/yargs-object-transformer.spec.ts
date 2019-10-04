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
});
