# Contributing

## Developing dc-cli

You consider contributing changes to dc-cli – thank you!
Please consider these guidelines when filing a pull request:

*  2 spaces indentation
*  Features and bug fixes should be covered by test cases

## Commit Messages

To keep our commit messages consistent, please run `npm run commit` instead of `git commit`.
You'll be prompted to fill in any required fields and your commit messages will be formatted according to our standards 

## Creating releases

to release new versions automatically.

*  Commits of type `fix` will trigger bugfix releases, think `0.0.1`
*  Commits of type `feat` will trigger feature releases, think `0.1.0`
*  Commits with `BREAKING CHANGE` in body or footer will trigger breaking releases, think `1.0.0`

All other commit types will trigger no new release.
