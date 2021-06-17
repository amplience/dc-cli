import { table, TableUserConfig } from 'table';
import chalk from 'chalk';
import { CommandOptions } from '../interfaces/command-options.interface';
import { baseTableConfig } from '../common/table/table.consts';

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
type PrintFn = (message: string) => void;

interface RenderOptions {
  json?: boolean;
  tableUserConfig?: TableUserConfig;
  itemMapFn?: MapFn;
  printFn?: PrintFn;
}

export default class DataPresenter {
  constructor(private readonly data: object | object[]) {}

  private generateHorizontalTable(json: object[], tableUserConfig: TableUserConfig | undefined): string {
    if (json.length === 0) {
      return '0 items returned.';
    }
    const rows = json.map(row => Object.values(row));
    const headerRow = Object.keys(json[0]).map(key => chalk.bold(key));
    return table([headerRow, ...rows], { ...baseTableConfig, ...(tableUserConfig || {}) });
  }

  private generateVerticalTable(json: object, tableUserConfig: TableUserConfig | undefined): string {
    const rows = Object.entries(json).map(value => [value[0], JSON.stringify(value[1])]);
    return table([[chalk.bold('Property'), chalk.bold('Value')], ...rows], {
      ...baseTableConfig,
      ...(tableUserConfig || {})
    });
  }

  public render(renderOptions: RenderOptions = {}): void {
    const itemMapFn: MapFn = renderOptions.itemMapFn ? renderOptions.itemMapFn : (v: object): object => v;

    let output;
    if (renderOptions.json) {
      output = JSON.stringify(this.data, null, 2);
    } else {
      output = Array.isArray(this.data)
        ? this.generateHorizontalTable(this.data.map(itemMapFn), renderOptions.tableUserConfig)
        : this.generateVerticalTable(itemMapFn(this.data), renderOptions.tableUserConfig);
    }

    if (renderOptions.printFn) {
      renderOptions.printFn(output);
    } else {
      if (!renderOptions.json) output += '\n';
      process.stdout.write(output);
    }
  }
}
