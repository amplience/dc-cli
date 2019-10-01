#!/usr/bin/env node

import { Arguments } from 'yargs';
import Yargs from 'yargs/yargs';
import YargsCommandBuilderOptions from './common/yargs/yargs-command-builder-options';
import { configureCommandOptions, readConfigFile } from './commands/configure';

export default (yargInstance = Yargs(process.argv.slice(2))): Arguments => {
  return yargInstance
    .options(configureCommandOptions)
    .config('config', readConfigFile)
    .commandDir('./commands', YargsCommandBuilderOptions)
    .demandCommand(1, 'Please specify at least one command').argv;
};
