import { Arguments } from 'yargs';
import { getBorderCharacters, table, TableUserConfig } from 'table';
import chalk from 'chalk';
import { CommandOptions } from '../interfaces/command-options.interface';
import { PageMetadata } from 'dc-management-sdk-js';

const DEFAULT_TABLE_CONFIG = {
  border: getBorderCharacters('ramac')
};

export interface PreRenderedData {
  [key: string]: unknown;
}
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

export default class DataPresenter<
  T extends { toJson: () => PreRenderedData | PreRenderedData[]; page?: PageMetadata }
> {
  private formattedData: PreRenderedData | PreRenderedData[];
  private readonly page: PageMetadata;

  constructor(
    private readonly argv: Arguments<RenderingArguments>,
    private readonly unformattedData: T,
    private readonly tableRenderingOptions?: TableUserConfig
  ) {
    this.page = this.unformattedData.page || {};
    this.formattedData = this.unformattedData.toJson();

    return this;
  }

  private renderPageInfo(): void {
    if (this.page.number !== undefined && this.page.totalPages !== undefined) {
      process.stdout.write(chalk.bold(`Displaying page ${this.page.number + 1} of ${this.page.totalPages}\n\n`));
    }
  }

  private generateHorizontalTable(json: PreRenderedData[]): unknown[][] {
    const rows = json.map(row => Object.values(row));
    const headerRow = Object.keys(json[0]).map(key => chalk.bold(key));
    return [headerRow, ...rows];
  }

  private generateVerticalTable(json: PreRenderedData): unknown[][] {
    const rows = Object.entries(json).map(value => [value[0], JSON.stringify(value[1])]);
    return [[chalk.bold('Property'), chalk.bold('Value')], ...rows];
  }

  public parse(converter: (unformattedData: T) => PreRenderedData | PreRenderedData[]): DataPresenter<T> {
    this.formattedData = converter(this.unformattedData);
    return this;
  }

  public render(): void {
    if (this.argv.json) {
      process.stdout.write(JSON.stringify(this.unformattedData.toJson(), null, 2));
      return;
    }

    const output = Array.isArray(this.formattedData)
      ? this.generateHorizontalTable(this.formattedData)
      : this.generateVerticalTable(this.formattedData);

    process.stdout.write(`${table(output, { ...DEFAULT_TABLE_CONFIG, ...this.tableRenderingOptions })}\n`);
    this.renderPageInfo();
  }
}
