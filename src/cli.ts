#!/usr/bin/env node

import CommandLineParserService from './configuration/command-line-parser.service';
import { Arguments } from 'yargs';

export default function(): Arguments {
  return new CommandLineParserService().parse();
}
