# dc-cli

Command line interface for Amplience Dynamic Content service.

## Description

**dc-cli** is a command line interface application for Amplience Dynamic Content management APIs.

Run `dc-cli --help` to get a list of available commands.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Installation](#installation)
- [Configuration](#configuration)
  - [Options](#options)
- [Command categories](#command-categories)
  - [content-type-schema](#content-type-schema)
  - [content-type](#content-type)
  - [content-item](#content-item)
  - [extension](#extension)
  - [search-index](#search-index)
  - [content-repository](#content-repository)
  - [event](#event)
  - [settings](#settings)
  - [hub](#hub)
- [Building the CLI](#building-the-cli)
- [Required permissions](#required-permissions)

<!-- /MarkdownTOC -->

## Installation

Installing the DC CLI from the NPM package manager can be achieved using the following command:

```bash
npm install -g @amplience/dc-cli
```

Or you can download the executable for your operating system on the [releases page](https://github.com/amplience/dc-cli/releases).

## Configuration

**dc-cli** requires a valid set of Amplience client credentials (`--clientId` & `--clientSecret`) and hub ID (`--hubId`) to operate.
These parameters must be set using the command `dc-cli configure --clientId <YOUR_CLIENT_ID> --clientSecret <YOUR_CLIENT_SECRET> --hubId <YOUR_HUB_ID>` before using the CLI.

Some commands (`content-item copy`, `content-item move`, & `hub-clone`) enable the export and import of content with a single command. These take additional options for the client credentials (`--dstClientId` & `--dstSecret`) and hub ID (`--dstHubId`) of a distinct Dynamic Content hub. If no destination options are provided, the destination for these commands will be the same as the source.

Once the tool has been configured the individual parameters can be overwritten by supplying them when running any of the commands, e.g `dc-cli <command> <action> --hubId <YOUR_HUB_ID>`.

By default the configuration is saved to a file in the directory `<HOME_DIR>/.amplience/`, this can be overridden using the `--config` option.

### Options

| Option Name    | Type                                                       | Description                                                  |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| --version      | [boolean]                                                  | Show version number                                          |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub                                 |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub                             |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub                                    |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file                                     |
| --help         | [boolean]                                                  | Show help                                                    |
| --logFile      | [string]<br />[default: (generated-value)]                 | Path to a log file to write to.                              |
| --dstHubId     | [string]                                                   | Destination hub ID. If not specified, it will be the same as the source. |
| --dstClientId  | [string]                                                   | Destination account's client ID. If not specified, it will be the same as the source. |
| --dstSecret    | [string]                                                   | Destination account's secret. Must be used alongside dstClientId. |

#### Examples

##### Create/Update configuration file for single hub

`dc-cli configure --clientId foo --clientSecret bar --hubId baz`

##### Create/Update configuration file for two-hub usage (copy/move/clone)

`dc-cli configure --clientId foo --clientSecret bar --hubId baz --dstClientId qux --dstSecret quux --dstHubId quuz`

## Command categories

### content-type-schema

This category includes interactions with content type schemas.

These commands can be used to retrieve information on one or more schemas, create new schemas, export and import schemas from an individual hub, as well as archiving and unarchiving schemas.

[View commands for **content-type-schema**](docs/CONTENT-TYPE-SCHEMA.md)

### content-type

This category includes interactions with content types.

These commands can be used to retrieve information on one or more types, register new types or update existing ones, export and import types from an individual hub, as well as archiving and unarchiving types.

Before importing content types you must ensure that a valid [content type schema](#content-type-schema) exists in the destination hub for each type.

[View commands for **content-type**](docs/CONTENT-TYPE.md)

### content-item

This category includes interactions with content items.

These commands can be used to export and import content from an individual hub, copy and move items between hubs, as well as archiving and unarchiving content.

Before importing, copying, or moving content you must ensure that a valid [content type](#content-type) exists in the destination hub for each content item.

[View commands for **content-item**](docs/CONTENT-ITEM.md)

### extension

This category includes interactions with Dynamic Content's UI Extensions, and can be used to export and import extensions from an individual hub.

[View commands for **extension**](docs/EXTENSION.md)

### search-index

This category includes interactions with Algolia search indexes for Dynamic Content, and can be used to export and import indexes from an individual hub.

[View commands for **search-index**](docs/SEARCH-INDEX.md)

### content-repository

This category includes interactions with Dynamic Content's repositories.

These commands can be used to get details for a specific repository, list multiple repositories, or assign or unassign content types from a repository. 

[View commands for **content-repository**](docs/CONTENT-REPOSITORY.md)

### event

This category includes interactions with Dynamic Content's events and its constituent parts (Editions, Slots, and Snapshots). These commands can be used to export and import events, and to archive events.

[View commands for **event**](docs/EVENT.md)

### settings

This category includes interactions with the supporting properties of a Dynamic Content hub. These commands can be used to export and import a hub's breakpoint settings for visualization, preview applications, workflow states, and locales.

[View commands for **settings**](docs/SETTINGS.md)

### hub

This category includes interactions with Dynamic Content's hubs in their entirety.

These commands can be used to copy a hub's settings and content in their entirety to another hub, or to archive all parts of a hub which can be archived. 

[View commands for **hub**](docs/HUB.md)

## Building the CLI

We have included some NPM scripts to help create various installations of the CLI.

- [Guide to building the CLI](docs/BUILDING_THE_CLI.md)

## Required permissions

Outlined below are the detailed permissions required to run each command of the CLI. To request an API key to run the CLI, please contact Amplience support.

| Command                                           | Required ACL(s)                                             | Required Functional Permission(s)                            |
| ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| `configure`                                       | Hub&nbsp;-&nbsp;READ                                        |                                                              |
| `content-repositories get <id>`                   | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:REPOSITORY:READ                           |
| `content-repositories list`                       | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:REPOSITORY:READ                           |
| `content-repositories assign-content-type <id>`   | ContentRepository&nbsp;-&nbsp;EDIT<br/>Hub&nbsp;-&nbsp;READ | CONTENT:FUNCTIONAL:REPOSITORY:EDIT                           |
| `content-repositories unassign-content-type <id>` | ContentRepository&nbsp;-&nbsp;EDIT<br/>Hub&nbsp;-&nbsp;READ | CONTENT:FUNCTIONAL:REPOSITORY:EDIT                           |
| `content-type get <id>`                           | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                         |
| `content-type list`                               | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                         |
| `content-type register`                           | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:CREATE                       |
| `content-type sync <id>`                          | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT                         |
| `content-type update <id>`                        | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT                         |
| `content-type import <dir>`                       | ContentRepository&nbsp;-&nbsp;EDIT<br/>Hub&nbsp;-&nbsp;READ | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ<br/>CONTENT:FUNCTIONAL:CONTENT_TYPE:CREATE<br/>CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT |
| `content-type export <dir>`                       | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                         |
| `content-type-schema create`                      | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:CREATE                       |
| `content-type-schema get <id>`                    | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                         |
| `content-type-schema list`                        | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ                         |
| `content-type-schema update <id>`                 | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT                         |
| `content-type-schema import <dir>`                | Hub&nbsp;-&nbsp;READ                                        | CONTENT:FUNCTIONAL:CONTENT_TYPE:READ<br/>CONTENT:FUNCTIONAL:CONTENT_TYPE:CREATE<br/>CONTENT:FUNCTIONAL:CONTENT_TYPE:EDIT |