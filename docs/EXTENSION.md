# extension

## Description

The **extension** command category includes a number of interactions with Dynamic Content's UI Extensions, and can be used to export and import extensions from an individual hub.

Run `dc-cli extension --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Commands](#commands)
  - [export](#export)
  - [import](#import)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **extension** commands.

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

### export

Exports extensions from the targeted Dynamic Content hub into the specified filesystem location.

```
dc-cli extension export <dir>
```

#### Options

| Option Name     | Type      | Description                                                  |
| --------------- | --------- | ------------------------------------------------------------ |
| --id            | [string]  | The ID of an Extension to be exported.<br/>If no --id option is given, all extensions for the hub are exported.<br/>A single --id option may be given to export a single extension.<br/>Multiple --id options may be given to export multiple extensions at the same time. |
| -f<br />--force | [boolean] | Overwrite extensions without asking.                         |

#### Examples

##### Export all extensions from a Hub

`dc-cli extension export ./myDirectory/extension`

##### Export extensions with IDs of 'foo' & 'bar'

`dc-cli extension export ./myDirectory/extension --id foo --id bar`

### import

Imports extensions from the specified filesystem location to the targeted Dynamic Content hub.

```
dc-cli extension import <dir>
```

#### Options

The import command only uses [common options](#Common Options)

#### Examples

##### Import extensions from the filesystem

`dc-cli extension import ./myDirectory/extension`

