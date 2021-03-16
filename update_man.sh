#!/bin/sh

if ! [ -x "$(command -v ronn)" ]; then
  echo 'Error: ronn is not installed. Install via "gem install ronn"' >&2
  exit 1
fi

ronn -r HOW_TO_USE.md
