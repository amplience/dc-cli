# dc-cli(1) - (Amplience) Dynamic Content command line interface
## SYNOPSIS

`dc-cli` `<command>` `[args]`

## DESCRIPTION
**dc-cli** is a command line interface application for Amplience Dynamic Content management APIs.

Run `dc-cli` to get a list of available commands

## CONFIGURATION
**dc-cli** requires a valid set of Amplience client credentials (`--clientId` & `--clientSecret`) and hub ID (`--hubId`) to operate. These must be supplied for each command or alternatively they can saved to a user-level configuration file using `dc-cli configure`.

By default the configuration file is saved into the directory `<HOME_DIR>/.amplience/`, this can be overridden using the `--config` option.

See `dc-cli configure --help` for more information.

## SEE ALSO
* `dc-cli --help`
* `dc-cli <command> --help`
* `README.md`
* https://docs.amplience.net/
