# dc-cli

Command line interface for Amplience Dynamic Content service.

## Description

**dc-cli** is a command line interface application for Amplience Dynamic Content management APIs.

Run `dc-cli` to get a list of available commands

## Installation

Installing the DC CLI from the NPM package manager can be achieved using the following command:

```bash
npm install -g @amplience/dc-cli
```

Or you can download the executable for your operating system on the [releases page](https://github.com/amplience/dc-cli/releases).

## Configuration

**dc-cli** requires a valid set of Amplience client credentials (`--clientKey` & `--clientSecret`) and hub ID (`--hubId`) to operate.
These parameters must be set using the command `dc-cli configure --clientKey <KEY> --clientSecret <SECRET> --hubId <ID>` before using the CLI.

Once the tool has been configured the individual parameters can be overwritten by supplying them when running any of the commands,
e.g `dc-cli <command> <action> --hubId <ID>`.

By default the configuration is saved to a file in the directory `<HOME_DIR>/.amplience/`, this can be overridden using the `--config` option.

See `dc-cli configure --help` for more information.

## Usage

- [How to use the CLI](HOW_TO_USE.md)
- [Export using the CLI](EXPORT_USAGE.md)
- [Import using the CLI](IMPORT_USAGE.md)

## Building the CLI

We have included some NPM scripts to help create various installations of the CLI.

- [Guide to building the CLI](BUILDING_THE_CLI.md)

## Required permissions

Outlined below are the detailed permissions required to run each command of the CLI. To request an API key to run the CLI, please contact Amplience support.

| Command                                           | Required ACL(s)                                             | Required Functional Permission(s)                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `configure`                                       | Hub&nbsp;-&nbsp;READ                                        |                                                                                                                          |
| `content-repositories get <id>`                   | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:REPOSITORY:READ                                                                                       |
| `content-repositories list`                       | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:REPOSITORY:READ                                                                                       |
| `content-repositories assign-content-type <id>`   | ContentRepository&nbsp;-&nbsp;EDIT<br/>Hub&nbsp;-&nbsp;READ | CONTENT:FUNCTIONAL:REPOSITORY:EDIT                                                                                       |
| `content-repositories unassign-content-type <id>` | ContentRepository&nbsp;-&nbsp;EDIT<br/>Hub&nbsp;-&nbsp;READ | CONTENT:FUNCTIONAL:REPOSITORY:EDIT                                                                                       |
| `content-type get <id>`                           | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                                                                                     |
| `content-type list`                               | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                                                                                     |
| `content-type register`                           | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:CREATE                                                                                   |
| `content-type sync <id>`                          | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT                                                                                     |
| `content-type update <id>`                        | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT                                                                                     |
| `content-type import <dir>`                       | ContentRepository&nbsp;-&nbsp;EDIT<br/>Hub&nbsp;-&nbsp;READ | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ<br/>CONTENT:FUNCTIONAL:CONTENT_TYPE:CREATE<br/>CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT |
| `content-type export <dir>`                       | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                                                                                     |
| `content-type-schema create`                      | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:CREATE                                                                                   |
| `content-type-schema get <id>`                    | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                                                                                     |
| `content-type-schema list`                        | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                                                                                     |
| `content-type-schema update <id>`                 | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT                                                                                     |
| `content-type-schema import <dir>`                | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ<br/>CONTENT:FUNCTIONAL:CONTENT_TYPE:CREATE<br/>CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT |
