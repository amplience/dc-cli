# content-type-schema

## Description

The **content-type-schema** command category includes a number of interactions with content type schemas.

These commands can be used to retrieve information on one or more schemas, create new schemas, export and import schemas from an individual hub, as well as archiving and unarchiving schemas.

Run `dc-cli content-type-schema --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Commands](#commands)
  - [archive](#archive)
  - [create](#create)
  - [export](#export)
  - [get](#get)
  - [import](#import)
  - [list](#list)
  - [unarchive](#unarchive)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **content-type-schema** commands.

| Option Name    | Type                                                       | Description                      |
| -------------- | ---------------------------------------------------------- | -------------------------------- |
| --version      | [boolean]                                                  | Show version number              |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub     |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub        |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file         |
| --help         | [boolean]                                                  | Show help                        |

## Commands

### archive

Archives a content type schema. This hides the schema from the active schema list in the Dynamic Content UI and prevents it being registered as a content type unless unarchived.

```
dc-cli content-type-schema archive [id]
```

#### Options

| Option Name      | Type                                       | Description                                                  |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------ |
| --schemaId       | [string]                                   | A regex can be provided to select multiple schemas with similar IDs (eg /.header.\.json/).<br/>A single --schemaId option may be given to archive a single content type schema.<br/>Multiple --schemaId options may be given to archive multiple content type schemas at the same time. |
| --revertLog      | [string]                                   | Path to a log file containing content unarchived in a previous run of the unarchive command.<br/>When provided, archives all schemas listed as unarchived in the log file. |
| -f<br />--force  | [boolean]                                  | If present, there will be no confirmation prompt before archiving the found content. |
| -s<br />--silent | [boolean]                                  | If present, no log file will be produced.                    |
| --ignoreError    | [boolean]                                  | If present, archive requests that fail will not abort the process. |
| --logFile        | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Archive all active content type schemas

`dc-cli content-type-schema archive`

##### Archive all active content type schemas containing "Christmas" in their URI

`dc-cli content-type-schema archive --schemaId "/Christmas/"`

### create

Imports a content type schema from a specified file on the filesystem to the targeted Dynamic Content hub.

```
dc-cli content-type-schema create
```

#### Options

| Option Name       | Type                                                         | Description                          |
| ----------------- | ------------------------------------------------------------ | ------------------------------------ |
| --schema          | [string]<br />[required]                                     | Content Type Schema source location. |
| --validationLevel | [string]<br />[required]<br />[choices: "SLOT", "CONTENT_TYPE", "PARTIAL"] | Content Type Schema validation Level |
| --json            | [boolean]<br />[default: false]                              | Render output as JSON                |

#### Examples

##### Import slot content type schema from the filesystem

`dc-cli content-type-schema create --schema ./myDirectory/schema/mySlot.json --validationLevel SLOT`

### export

Exports content type schemas from the targeted Dynamic Content hub into the specified filesystem location.

More details can be found in [export usage](EXPORT_USAGE.md#CONTENT-TYPE-SCHEMAS).

```
dc-cli content-type-schema export <dir>
```

#### Options

| Option Name     | Type                                       | Description                                                  |
| --------------- | ------------------------------------------ | ------------------------------------------------------------ |
| --schemaId      | [string]                                   | The Schema ID of a Content Type Schema to be exported.<br/>If no --schemaId option is given, all content type schemas for the hub are exported.<br/>A single --schemaId option may be given to export a single content type schema.<br/>Multiple --schemaId options may be given to export multiple content type schemas at the same time. |
| -f<br />--force | [boolean]                                  | Overwrite content type schema without asking.                |
| --archived      | [boolean]                                  | If present, archived content type schemas will also be considered. |
| --logFile       | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Export all content type schemas from a Hub

`dc-cli content-type-schema export ./myDirectory/schema`

##### Export all content type schemas with "Christmas" in their URI

`dc-cli content-type-schema export ./myDirectory/schema --schemaId "/Christmas/"`

### get

Returns information for a single content type schema. Returns status, validation level, body, schema ID (URI), created & modified by user, created & modified dates, version, and ID.

```
dc-cli content-type-schema get <id>
```

#### Options

| Option Name | Type                            | Description           |
| ----------- | ------------------------------- | --------------------- |
| --json      | [boolean]<br />[default: false] | Render output as JSON |

#### Examples

##### Get details for specific content type schema with ID of 'foo'

`dc-cli content-type-schema get foo`

### import

Imports content type schemas from the specified filesystem location to the targeted Dynamic Content hub. It is recommended that you check that any content items you intend to import are still valid with any changes you make to your content type schemas. Please see [guidelines for making changes to a content type schema](https://amplience.com/docs/integration/refreshingcontenttypes.html#guidelines) for more information.

More details on schema import can be found in [import usage](IMPORT_USAGE.md#CONTENT-TYPE-SCHEMAS).

```
dc-cli content-type-schema import <dir>
```

#### Options

| Option Name | Type                                       | Description                     |
| ----------- | ------------------------------------------ | ------------------------------- |
| --logFile   | [string]<br />[default: (generated-value)] | Path to a log file to write to. |

#### Examples

##### Import content type schemas from the filesystem

`dc-cli content-type-schema import ./myDirectory/schema`

### list

Returns information for a all content type schemas in the target hub. Returns ID, schema ID (URI), version, and schema validation level. 

```
dc-cli content-type-schema list
```

#### Options

| Option Name | Type                            | Description           |
| ----------- | ------------------------------- | --------------------- |
| --json      | [boolean]<br />[default: false] | Render output as JSON |

#### Examples

##### List all content type schemas

`dc-cli content-type-schema list`

### unarchive

Unarchives a content type schema. This returns the schema to the active schema list in the Dynamic Content UI and allows it to be registered as a content type once more.

```
dc-cli content-type-schema unarchive [id]
```

#### Options

| Option Name      | Type                                       | Description                                                  |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------ |
| --schemaId       | [string]                                   | A regex can be provided to select multiple schemas with similar IDs (eg /.header.\.json/).<br/>A single --schemaId option may be given to unarchive a single content type schema.<br/>Multiple --schemaId options may be given to unarchive multiple content type schemas at the same time. |
| --revertLog      | [string]                                   | Path to a log file containing content archived in a previous run of the archive command.<br/>When provided, unarchives all schemas listed as archived in the log file. |
| -f<br />--force  | [boolean]                                  | If present, there will be no confirmation prompt before unarchiving the found content. |
| -s<br />--silent | [boolean]                                  | If present, no log file will be produced.                    |
| --ignoreError    | [boolean]                                  | If present, unarchive requests that fail will not abort the process. |
| --logFile        | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Unarchive all archived content type schemas

`dc-cli content-type-schema unarchive`

##### Unarchive all archived content type schemas containing "Christmas" in their URI

`dc-cli content-type-schema unarchive --schemaId "/Christmas/"`
