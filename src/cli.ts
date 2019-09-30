#!/usr/bin/env node

import CommandLineParserService from './configuration/command-line-parser.service';
import { Arguments } from 'yargs';

import Yargs from 'yargs/yargs';

export default (): Arguments => {
  const argv = Yargs(process.argv.slice(2));
  return new CommandLineParserService(argv).parse();
};
