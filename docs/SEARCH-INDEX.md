# search-index

## Description

The **search-index** command category includes a number of interactions with Algolia search indexes for Dynamic Content, and can be used to export and import indexes from an individual hub.

Run `dc-cli search-index --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Commands](#commands)
  - [Export](#export)
  - [Import](#import)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **search-index** commands.

| Option Name    | Type                                                       | Description                      |
| -------------- | ---------------------------------------------------------- | -------------------------------- |
| --version      | [boolean]                                                  | Show version number              |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub     |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub        |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file         |
| --help         | [boolean]                                                  | Show help                        |
| --logFile      | [string]<br />[default: (generated-value)]                 | Path to a log file to write to.  |

## Commands

### Export

Exports search indexes from the targeted Dynamic Content hub into the specified filesystem location.

```
dc-cli search-index export <dir>
```

#### Options

| Option Name     | Type      | Description                                                  |
| --------------- | --------- | ------------------------------------------------------------ |
| --id            | [string]  | The ID of a Search Index to be exported.<br/>If no --id option is given, all search indexes for the hub are exported.<br/>A single --id option may be given to export a single Search Index.<br/>Multiple --id options may be given to export multiple search indexes at the same time. |
| -f<br />--force | [boolean] | Overwrite search indexes without asking.                     |

#### Examples

##### Export search indexes

`dc-cli search-index export ./myDirectory/indexes`

### Import

Imports search indexes from the specified filesystem location to the targeted Dynamic Content hub.

```
dc-cli search-index import <dir>
```

#### Options

| Option Name | Type      | Description                                                  |
| ----------- | --------- | ------------------------------------------------------------ |
| --webhooks  | [boolean] | Import the index's webhooks as well as the index itself.<br />The command will attempt to rewrite account names and staging environments in the webhook body to match the destination. |

#### Examples

##### Import search indexes without custom payload

`dc-cli search-index import ./myDirectory/indexes`

##### Import search indexes with custom payload

`dc-cli search-index import ./myDirectory/indexes --webhooks`