# content-type

## Description

The **content-type** command category includes a number of interactions with content types.

These commands can be used to retrieve information on one or more types, register new types or update existing ones, export and import types from an individual hub, as well as archiving and unarchiving types.

Before importing content types you must ensure that a valid [content type schema](#CONTENT-TYPE-SCHEMA.md) exists in the destination hub for each type.

Run `dc-cli content-type --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Commands](#commands)
  - [archive](#archive)
  - [export](#export)
  - [get](#get)
  - [import](#import)
  - [list](#list)
  - [register](#register)
  - [sync](#sync)
  - [unarchive](#unarchive)
  - [update](#update)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **content-type** commands.

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

### archive

Archives one or more content types. This hides them from the active content type list in the Dynamic Content UI and prevents new content items being created of that type.

```
dc-cli content-type archive [id]
```

#### Options

| Option Name      | Type                                       | Description                                                  |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------ |
| --schemaId       | [string]                                   | The Schema ID of a Content Type's Schema to be archived.<br/>A regex can be provided to select multiple types with similar or matching schema IDs (eg /.header.\.json/).<br/>A single --schemaId option may be given to match a single content type schema.<br/>Multiple --schemaId options may be given to match multiple content type schemas at the same time. |
| --revertLog      | [string]                                   | Path to a log file containing content unarchived in a previous run of the unarchive command.<br/>When provided, archives all types listed as unarchived in the log file. |
| -f<br />--force  | [boolean]                                  | If present, there will be no confirmation prompt before archiving the found content. |
| -s<br />--silent | [boolean]                                  | If present, no log file will be produced.                    |
| --ignoreError    | [boolean]                                  | If present, unarchive requests that fail will not abort the process. |
| --logFile        | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Archive all active content types

`dc-cli content-type archive`

##### Archive all active content types containing "Christmas" in their URI

`dc-cli content-type archive --schemaId "/Christmas/"`

### export

Exports content types from the targeted Dynamic Content hub into the specified filesystem location.

More details can be found in [export usage](EXPORT_USAGE.md#CONTENT-TYPES).

```
dc-cli content-type export <dir>
```

#### Options

| Option Name     | Type                                       | Description                                                  |
| --------------- | ------------------------------------------ | ------------------------------------------------------------ |
| --schemaId      | [string]                                   | The Schema ID of a Content Type to be exported.<br/>If no --schemaId option is given, all content types for the hub are exported.<br/>A single --schemaId option may be given to export a single content type.<br/>Multiple --schemaId options may be given to export multiple content types at the same time. |
| -f<br />--force | [boolean]                                  | Overwrite content types without asking.                      |
| --archived      | [boolean]                                  | If present, archived content types will also be considered.  |
| --logFile       | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Export all content types from a Hub

`dc-cli content-type export ./myDirectory/type`

##### Export all content types with "Christmas" in their schema URI

`dc-cli content-type export ./myDirectory/type --schemaId "/Christmas/"`

### get

Returns information for a single content type. Returns ID, URI, status, and settings.

```
dc-cli content-type get <id>
```

#### Options

| Option Name | Type                            | Description           |
| ----------- | ------------------------------- | --------------------- |
| --json      | [boolean]<br />[default: false] | Render output as JSON |

#### Examples

##### Get details for specific content type with ID of 'foo'

`dc-cli content-type get foo`

### import

Imports content types from the specified filesystem location to the targeted Dynamic Content hub.

Before importing content types you must ensure that a valid [content type schema](#CONTENT-TYPE-SCHEMA.md) exists in the destination hub for each content type.

More details can be found in [import usage](IMPORT_USAGE.md#CONTENT-TYPES).

```
dc-cli content-type import <dir>
```

#### Options

| Option Name  | Type                                       | Description                                   |
| ------------ | ------------------------------------------ | --------------------------------------------- |
| --sync       | [boolean]<br />[default: false]            | Automatically sync Content Type schema.       |
| --skipAssign | [boolean]<br />[default: false]            | Skip assigning content types to repositories. |
| --logFile    | [string]<br />[default: (generated-value)] | Path to a log file to write to.               |

#### Examples

##### Import content types from the filesystem

`dc-cli content-type import ./myDirectory/type`

### list

Returns information for a all content types in the target hub. Returns ID, label, and schema ID (URI).

```
dc-cli content-type list
```

#### Options

| Option Name | Type                            | Description                                               |
| ----------- | ------------------------------- | --------------------------------------------------------- |
| --sort      | [string]                        | How to order the list e.g "\<property\>,\<asc\|desc\>..." |
| --json      | [boolean]<br />[default: false] | Render output as JSON                                     |

#### Examples

##### List all content types

`dc-cli content-type list`

### register

Registers a new content type with an existing content type schema in the targeted Dynamic Content hub. Allows you to specify custom cards and icons, as well as visualization URLs.

Before registering a content type you must ensure that a valid [content type schema](#CONTENT-TYPE-SCHEMA.md) exists in the destination hub for this content type.

```
dc-cli content-type register
```

#### Options

| Option Name      | Type                            | Description                       |
| ---------------- | ------------------------------- | --------------------------------- |
| --schemaId       | [string]<br />[required]        | The content type's schema ID      |
| --label          | [string]<br />[required]        | The content type's label          |
| --icons          | [default: {}]                   | The content type's icons          |
| --visualizations | [default: {}]                   | The content type's visualizations |
| --cards          | [default: {}]                   | The content type's cards          |
| --json           | [boolean]<br />[default: false] | Render output as JSON             |

#### Examples

##### Registering a content type with an existing schema

`dc-cli content-type register --schemaId https://example.com/foo.json --label bar`

##### Add an icon when registering a new content type

`dc-cli content-type register --schemaId https://example.com/foo.json --icons.0.size 256 --icons.0.url "https://example.com/bar.jpg"`

##### Add a visualization when registering a new content type

`dc-cli content-type register --schemaId https://example.com/foo.json --visualizations.0.label "bar" --visualizations.0.templatedUri "https://example.com/baz" --visualizations.0.default true`

##### Add a card when registering a new content type

`dc-cli content-type register --schemaId https://example.com/foo.json —-cards.0.label "bar" —-cards.0.templatedUri "https://schema.localhost.com/baz" —-cards.0.default true`

### sync

Synchronises a content type, so that it matches the present version of its registered schema.

```
dc-cli content-type sync <id>
```

#### Options

| Option NameOption Name | TypeType                        | DescriptionDescription |
| ---------------------- | ------------------------------- | ---------------------- |
| --json                 | [boolean]<br />[default: false] | Render output as JSON  |

#### Examples

##### Synchronise content type with ID of 'foo' with its content type schema

`dc-cli content-type sync foo`

### unarchive

Unarchives one or more content types. This returns them to the active content type list in the Dynamic Content UI and allows new content items to be created of that type once more.

```
dc-cli content-type unarchive [id]
```

#### Options

| Option Name      | Type                                       | Description                                                  |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------ |
| --schemaId       | [string]                                   | The Schema ID of a Content Type's Schema to be unarchived.<br/>A regex can be provided to select multiple types with similar or matching schema IDs (eg /.header.\.json/).<br/>A single --schemaId option may be given to match a single content type schema.<br/>Multiple --schemaId options may be given to match multiple content type schemas at the same time. |
| --revertLog      | [string]                                   | Path to a log file containing content archived in a previous run of the archive command.<br/>When provided, unarchives all types listed as archived in the log file. |
| -f<br />--force  | [boolean]                                  | If present, there will be no confirmation prompt before unarchiving the found content. |
| -s<br />--silent | [boolean]                                  | If present, no log file will be produced.                    |
| --ignoreError    | [boolean]                                  | If present, unarchive requests that fail will not abort the process. |
| --logFile        | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Unarchive all archived content types

`dc-cli content-type unarchive`

##### Unarchive all archived content types containing "Christmas" in their URI

`dc-cli content-type unarchive --schemaId "/Christmas/"`

### update

Updates the supporting properties of the content type, including custom cards and icons, as well as visualization URLs.

```
dc-cli content-type update <id>
```

#### Options

| Option Name      | Type                            | Description                       |
| ---------------- | ------------------------------- | --------------------------------- |
| --label          | [string]<br />[required]        | The content type's label          |
| --icons          | [default: {}]                   | The content type's icons          |
| --visualizations | [default: {}]                   | The content type's visualizations |
| --cards          | [default: {}]                   | The content type's cards          |
| --json           | [boolean]<br />[default: false] | Render output as JSON             |

#### Examples

##### Add an icon when updating a content type

`dc-cli content-type update foo --icons.0.size 256 --icons.0.url "https://example.com/bar.jpg"`

##### Add a visualization when updating a content type

`dc-cli content-type update foo --visualizations.0.label "bar" --visualizations.0.templatedUri "https://example.com/baz" --visualizations.0.default true`

##### Add a card when updating a content type

`dc-cli content-type update foo —-cards.0.label "bar" —-cards.0.templatedUri "https://schema.localhost.com/baz" —-cards.0.default true`