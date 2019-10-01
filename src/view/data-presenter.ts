import { Arguments } from 'yargs';
import { getBorderCharacters, table, TableUserConfig } from 'table';
import chalk from 'chalk';
import { CommandOptions } from '../interfaces/command-options.interface';
import { PageMetadata } from 'dc-management-sdk-js';

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

const tableUserConfig = {
  border: getBorderCharacters('ramac')
};

function renderList(json: PreRenderedData[]): unknown[][] {
  const rows = json.map(row => Object.values(row));
  const headerRow = Object.keys(json[0]).map(key => chalk.bold(key));
  return [headerRow, ...rows];
}

function renderSingle(json: PreRenderedData): unknown[][] {
  const rows = Object.entries(json).map(value => [value[0], JSON.stringify(value[1])]);
  return [[chalk.bold('Property'), chalk.bold('Value')], ...rows];
}

export function renderPageInfo(page: PageMetadata = {}): void {
  if (page && page.number !== undefined && page.totalPages !== undefined) {
    process.stdout.write(chalk.bold(`Displaying page ${page.number + 1} of ${page.totalPages}\n\n`));
  }
}

export function renderData<T extends { toJson: () => PreRenderedData | PreRenderedData[]; page?: PageMetadata }>(
  argv: Arguments<RenderingArguments>,
  preRenderedData: T,
  formatterFn?: (preRenderedData: T) => PreRenderedData | PreRenderedData[],
  userConfig?: TableUserConfig
): void {
  if (argv.json) {
    process.stdout.write(JSON.stringify(preRenderedData.toJson(), null, 2));
    return;
  }
  const json = formatterFn ? formatterFn(preRenderedData) : preRenderedData.toJson();
  const output = Array.isArray(json) ? renderList(json) : renderSingle(json);

  process.stdout.write(`${table(output, { ...tableUserConfig, ...userConfig })}\n`);
  renderPageInfo(preRenderedData.page);
}
