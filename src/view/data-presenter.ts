import { getBorderCharacters, table, TableUserConfig } from 'table';
import chalk from 'chalk';
import { CommandOptions } from '../interfaces/command-options.interface';
import { PageMetadata } from 'dc-management-sdk-js';

const DEFAULT_TABLE_CONFIG = {
  border: getBorderCharacters('ramac')
};

export interface RenderingArguments {
  json?: boolean;
}

export const RenderingOptions: CommandOptions = {
  json: {
    type: 'boolean',
    default: false,
    description: 'Render output as JSON'
  }
};

type MapFn = (data: object) => object;

interface RenderOptions {
  json?: boolean;
  tableUserConfig?: TableUserConfig;
  itemMapFn?: MapFn;
}

export default class DataPresenter {
  constructor(private readonly data: object | object[], private readonly page?: PageMetadata) {}

  private generateHorizontalTable(json: object[]): unknown[][] {
    const rows = json.map(row => Object.values(row));
    const headerRow = Object.keys(json[0]).map(key => chalk.bold(key));
    return [headerRow, ...rows];
  }

  private generateVerticalTable(json: object): unknown[][] {
    const rows = Object.entries(json).map(value => [value[0], JSON.stringify(value[1])]);
    return [[chalk.bold('Property'), chalk.bold('Value')], ...rows];
  }

  public render(renderOptions: RenderOptions = {}): void {
    const itemMapFn: MapFn = renderOptions.itemMapFn ? renderOptions.itemMapFn : (v: object): object => v;

    let output = '';
    if (renderOptions.json) {
      output = JSON.stringify(this.data, null, 2);
    } else {
      const tableData = Array.isArray(this.data)
        ? this.generateHorizontalTable(this.data.map(itemMapFn))
        : this.generateVerticalTable(itemMapFn(this.data));

      output += table(tableData, { ...DEFAULT_TABLE_CONFIG, ...renderOptions.tableUserConfig }) + '\n';
      if (
        Array.isArray(this.data) &&
        this.page &&
        this.page.number !== undefined &&
        this.page.totalPages !== undefined
      ) {
        output += chalk.bold(`Displaying page ${this.page.number + 1} of ${this.page.totalPages}`) + '\n';
      }
    }
    process.stdout.write(output);
  }
}
