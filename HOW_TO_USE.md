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

## FACETS
The content item export, copy, move archive and unarchive commands allow the user to provide a facet string to filter the content that the commands work on. Multiple of these can be applied at a time, and you can even match on regex string. Note that you will need to surround your facet in quotes if it contains a space, which will change how backslash escaping works.

- `name`: Filter on content item label. Example: `--facet "name:exact name match"`
- `schema`: Filter on schema ids. Example: `--facet schema:http://example.com/schema.json`
- `locale`: Filter on content item locale. Example: `--facet locale:en-GB`
- `lastModifiedDate`: Filter on last modified date. Example: `--facet "lastModifiedDate:Last 7 days"`

Multiple facets can be applied at once when separated by a comma. Example:
`--facet "schema:http://example.com/schema.json, name:/name regex/"`

Commas can be escaped with a backslash, if they are used in your values. The whitespace after a comma is optional.

### PRESET DATE RANGES
The preset date ranges are the same as DC provides:
- `Last 7 days`
- `Last 14 days`
- `Last 30 days`
- `Last 60 days`
- `Over 60 days`

### REGEX
You can use regex values on string fields when filtering content. They cannot be used on date ranges. Regex are surronded by two forward slashes:
`--facet "name:/ends with this$/"`

## SEE ALSO
* `dc-cli --help`
* `dc-cli <command> --help`
* `README.md`
* https://docs.amplience.net/
