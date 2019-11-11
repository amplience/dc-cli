import { getBorderCharacters } from 'table';

export const baseTableConfig = {
  border: getBorderCharacters('ramac')
};

export const singleItemTableOptions = {
  ...baseTableConfig,
  columns: {
    1: {
      width: 100
    }
  }
};

export const streamTableOptions = {
  ...baseTableConfig,
  columnDefault: {
    width: 50
  },
  columnCount: 3,
  columns: {
    0: {
      width: 24
    },
    1: {
      width: 100
    },
    2: {
      width: 10
    }
  }
};
