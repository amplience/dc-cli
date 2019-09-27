import { Arguments } from 'yargs';
import { getBorderCharacters, table, TableUserConfig } from 'table';
import chalk from 'chalk';
import { CommandOptions } from '../interfaces/command-options.interface';

export interface RenderingArguments {
  json: boolean;
}

export const RenderingOptions: CommandOptions = {
  json: {
    type: 'boolean',
    default: false,
    description: 'Render output as JSON'
  }
};

export function renderData(argv: Arguments<RenderingArguments>, json: { [key: string]: unknown }): void {
  if (argv.json) {
    process.stdout.write(JSON.stringify(json, null, 2));
    return;
  }
  const rows = Object.entries(json).map(value => [value[0], JSON.stringify(value[1])]);
  const userConfig: TableUserConfig = {
    border: getBorderCharacters('ramac'),
    columns: {
      1: {
        width: 100
      }
    }
  };
  const output = table([[chalk.bold('Property'), chalk.bold('Value')], ...rows], userConfig);
  process.stdout.write(output);
}
