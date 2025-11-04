# webhook

## Description

The **webhook** command category includes a number of interactions with webhooks.

These commands can be used to export, import and delete webhooks from an individual hub.

Run `dc-cli webhook --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Commands](#commands)
  - [export](#export)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **webhook** commands.

| Option Name    | Type                                                       | Description                      |
| -------------- | ---------------------------------------------------------- | -------------------------------- |
| --version      | [boolean]                                                  | Show version number              |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub     |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub        |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file         |
| --help         | [boolean]                                                  | Show help                        |

## Commands

### export

Exports webhooks from the targeted Dynamic Content hub into a folder called **exported_webhooks** at the user specified file path.

**Note**: No secret or auth header values will be exported.

```
dc-cli webhook export <dir>
```

#### Options

| Option Name | Type                                       | Description                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| --id        | [string]                                   | The ID of the webhook to be exported.<br/>If no --id option is given, all webhooks for the hub are exported.<br/>A single --id option may be given to export a single webhook.<br/>Multiple --id options may be given to delete multiple webhooks at the same time. |
| --logFile   | [string]<br />[default: (generated-value)] | Path to a log file to write to.                                                                                                                                                                                                                                     |

#### Examples

##### Export all webhooks from a hub

`dc-cli webhook export ./myDirectory/content`

##### Export a single webhook from a hub

`dc-cli webhook export ./myDirectory/content --id 1111111111`

##### Export multiple webhooks from a hub

`dc-cli webhook export ./myDirectory/content --id 1111111111  --id 2222222222`

### import

Imports webhooks from the specified filesystem location to the targeted Dynamic Content hub.

**Note**: The following values will be stripped out / not included during the import:

- **secret** - this will be recreated for the webhook in the destination hub during import.
- **createdDate** - this will be assigned during import (if webhook is being created).
- **lastModifiedDate** - this will be assigned during import (if webhook is being updated).
- **any header objects that are secrets** - these need to be manually assigned for the webhook in the destination hub.

Please see [the content-management API reference for Webhooks](https://amplience.com/developers/docs/apis/content-management-reference/#tag/Webhooks) for more information.

For any **customPayload** the following property values will be replaced by those in the destination hub:

- account
- stagingEnvironment

```
dc-cli webhook import <dir>
```

#### Options

| Option Name      | Type                                       | Description                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| --mapFile        | [string]                                   | Mapping file to use when updating content that already exists.<br />Updated with any new mappings that are generated. If not present, will be created.<br />For more information, see [mapping files](#MAPPING-FILES). |
| --logFile        | [string]<br />[default: (generated-value)] | Path to a log file to write to.                                                                                                                                                                                        |
| -s<br />--silent | [boolean]                                  | If present, no log file will be produced.                                                                                                                                                                              |
| -f<br />--force  | [boolean]                                  | Overwrite webhooks without asking.                                                                                                                                                                                     |

#### Examples

##### Import content from the filesystem

`dc-cli webhook import ./myDirectory/webhooks`

##### Specify a mapping file when importing

`dc-cli webhook import ./myDirectory/webhooks --mapFile ./myDirectory/mappingFile.json`
