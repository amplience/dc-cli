#!/usr/bin/env node

export default function helloWorld(name: string): string {
  return `Hello ${name}`;
}

console.log(helloWorld('World'));
