# content-item

## Description

The **content-item** command category includes a number of interactions with content items.

These commands can be used to export and import content from an individual hub, copy and move items between hubs, as well as archiving and unarchiving content.

Before importing, copying, or moving content you must ensure that a valid [content type](#CONTENT-TYPE.md) exists in the destination hub for each content item.

Run `dc-cli content-item --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Useful Information](#useful-information)
    - [Mapping files](#mapping-files)
    - [Facets](#facets)
    - [Media-link rewriting](#media-link-rewriting)
- [Commands](#commands)
    - [export](#export)
    - [import](#import)
    - [copy](#copy)
    - [move](#move)
    - [archive](#archive)
    - [unarchive](#unarchive)
    - [tree](#tree)
    - [publish](#publish)
    - [workflow](#workflow)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **content-item** commands.

| Option Name    | Type                                                       | Description                      |
| -------------- | ---------------------------------------------------------- | -------------------------------- |
| --version      | [boolean]                                                  | Show version number              |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub     |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub        |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file         |
| --help         | [boolean]                                                  | Show help                        |

## Useful Information

### Mapping files

When importing content with the DC CLI, this creates or references a mapping file to determine whether the imported content item should be created as new, or if an existing one within the Dynamic Content platform should be updated.

For example exporting a content item (eg `11111111-1111-1111-1111-111111111111`) from one hub then importing it to another for the first time will create a new content item with a randomly generated UUID (eg `22222222-2222-2222-2222-222222222222`). 

To instruct the DC CLI on which content item to update with future actions, a mapping between the source and destination is stored in a mapping file. This mapping file will contain an array of every content item mapping identified for jobs using that mapping file. Using the previous examples:

```
{
    "contentItems": [
        [
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222"
        ]
    ],
    "workflowStates": []
}
```

If no mapping file is specified (with the `--mapFile` argument) then a default one will be created, using the destination's resource type (hub, repository, folder) and its ID, and stored within a default location in your user directory. For example:

* Mac: `~/.amplience/imports/hub-111111111111111111111111.json`
* Windows: `%UserProfile%\.amplience\imports\hub-111111111111111111111111.json`

If a mapping file does not exist at the point of import, then any imported content items will be created as new, and a new mapping file will be created. If a mapping file exists, and was provided with the `--mapFile` argument, then any items found within the mapping file will be updated. Any content items not contained in the mapping file will will be created as new, and will then be added to the mapping file.

### Facets

The content item export, copy, move, publish, workflow, archive and unarchive commands allow the user to provide a facet string to filter the content that the commands work on. Multiple of these can be applied at a time, and you can even match on a regular expressions (RegEx) string. Note that you will need to surround your facet in quotes if it contains a space, which will change how backslash escaping works.

- `name`: Filter on content item label. Example: `--facet "name:exact name match"`
- `schema`: Filter on schema ids. Example: `--facet schema:http://example.com/schema.json`
- `locale`: Filter on content item locale. Example: `--facet locale:en-GB`
- `lastModifiedDate`: Filter on last modified date. Example: `--facet "lastModifiedDate:Last 7 days"`

Multiple facets can be applied at once when separated by a comma. Example:
`--facet "schema:http://example.com/schema.json, name:/name regex/"`

Commas can be escaped with a backslash, if they are used in your values. The whitespace after a comma is optional.

#### Preset date ranges

The preset date ranges are the same as DC provides:

- `Last 7 days`
- `Last 14 days`
- `Last 30 days`
- `Last 60 days`
- `Over 60 days`

#### Regular expressions

You can use regex values on string fields when filtering content. They cannot be used on date ranges. Regex are surronded by two forward slashes:
`--facet "name:/ends with this$/"`

### Media-link rewriting

The DC CLI is capable of importing or copying content into a Dynamic Content hub which resides on a distinct Content Hub account to the source by using the `--media` option with the import, copy, and move commands. This will update the `endpoint`, `id`, and `defaultHost` values for any `media-link` objects to reflect the endpoint of the destination hub's account, if an asset with a matching name exists in the destination account.

This functionality requires additional Content Hub-specific permissions granting to your DC CLI client in order to grant it visibility of the destination account's media assets (`DAM:ASSET STORE:ASSET_STORE_NAME`).

## Commands

### export

Exports content items from the targeted Dynamic Content hub into the specified filesystem location.

```
dc-cli content-item export <dir>
```

#### Options

| Option Name                    | Type                                       | Description                                                  |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| --repoId                       | [string]                                   | Export content from within a given repository.<br />Directory  structure will start at the specified repository.<br />Will automatically export all contained folders. |
| --folderId                     | [string]                                   | Export content from within a given folder.<br />Directory structure will start at the specified folder.<br />Can be used in addition to repoId. |
| --facet                        | [string]                                   | Export content matching the given facets.<br />Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values.<br />A regex can be provided for text filters, surrounded with forward slashes.<br />For more examples, see [facets](#FACETS). |
| --schemaId<br />*(Deprecated)* | [string]                                   | Export content with a given or matching Schema ID.<br />A regex can be provided, surrounded with forward slashes.<br />Can be used in combination with other filters.<br /><br />Deprecated by the [--facet](#facets) option. |
| --name<br />*(Deprecated)*     | [string]                                   | Export content with a given or matching Name.<br />A regex can be provided, surrounded with forward slashes.<br />Can be used in combination with other filters.<br /><br />Deprecated by the [--facet](#facets) option. |
| --publish                      | [boolean]                                  | When available, export the last published version of a content item rather than its newest version. |
| --logFile                      | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Export all content items from a Hub

`dc-cli content-item export ./myDirectory/content`

##### Export all content items from a specific repository

`dc-cli content-item export ./myDirectory/content --repoId 111111111111111111111111`

##### Export all content items with the "banner" schema type, with "Christmas" in their name

`dc-cli content-item export ./myDirectory/content --facet "schema:/.+banner.json$/,name:/Christmas/"`

### import

Imports content items from the specified filesystem location to the targeted Dynamic Content hub.

Before importing content you must ensure that a valid [content type](#CONTENT-TYPE.md) exists in the destination hub for each content item. It is also recommended that you check that any content items to be imported are still valid if any changes have been made to your content type schemas. Please see [guidelines for making changes to a content type schema](https://amplience.com/docs/integration/refreshingcontenttypes.html#guidelines) for more information.

```
dc-cli content-item import <dir>
```

#### Options

| Option Name        | Type                                       | Description                                                  |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| --baseRepo         | [string]                                   | Import matching the given repository to the import base directory, by ID.<br />Folder structure will be followed and replicated from there. |
| --baseFolder       | [string]                                   | Import matching the given folder to the import base directory, by ID.<br />Folder structure will be followed and replicated from there. |
| --mapFile          | [string]                                   | Mapping file to use when updating content that already exists.<br />Updated with any new mappings that are generated. If not present, will be created.<br />For more information, see [mapping files](#MAPPING-FILES). |
| -f<br />--force    | [boolean]                                  | Overwrite content, create and assign content types, and ignore content with missing types/references without asking. |
| -v<br />--validate | [boolean]                                  | Only recreate folder structure - content is validated but not imported. |
| --skipIncomplete   | [boolean]                                  | Skip any content items that has one or more missing dependancy. |
| --publish          | [boolean]                                  | Publish any content items that have an existing publish status in their JSON. |
| --republish        | [boolean]                                  | Republish content items regardless of whether the import changed them or not.<br />(--publish not required) |
| --excludeKeys      | [boolean]                                  | Exclude delivery keys when importing content items.          |
| --media            | [boolean]                                  | Detect and rewrite media links to match assets in the target account's Content Hub. Your client must have Content Hub permissions configured. |
| --logFile          | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Import content from the filesystem

`dc-cli content-item import ./myDirectory/content`

##### Specify a mapping file when importing

`dc-cli content-item import ./myDirectory/content --mapFile ./myDirectory/mappingFile.json`

##### Import content into a specific repository

`dc-cli content-item import ./myDirectory/content --baseRepo 111111111111111111111111`

### copy

Exports content items from the source hub and imports it into the destination hub with a single command.

Before copying content you must ensure that a valid [content type](#CONTENT-TYPE.md) exists in the destination hub for each content item.

```
dc-cli content-item copy <dir>
```

#### Options

| Option Name        | Type                                       | Description                                                  |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| --revertLog        | [string]                                   | Path to a log file to revert a copy for.<br />This will archive the most recently copied resources, and revert updated ones. |
| --srcRepo          | [string]                                   | Copy content from within a given repository.<br />Directory structure will start at the specified repository.<br />Will automatically export all contained folders. |
| --srcFolder        | [string]                                   | Copy content from within a given folder.<br />Directory structure will start at the specified folder.<br />Can be used in addition to repoId. |
| --dstRepo          | [string]                                   | Copy matching the given repository to the source base directory, by ID.<br />Folder structure will be followed and replicated from there. |
| --dstFolder        | [string]                                   | Copy matching the given folder to the source base directory, by ID.<br />Folder structure will be followed and replicated from there. |
| --dstHubId         | [string]                                   | Destination hub ID.<br />If not specified, it will be the same as the source. |
| --dstClientId      | [string]                                   | Destination account's client ID.<br />If not specified, it will be the same as the source. |
| --dstSecret        | [string]                                   | Destination account's secret.<br />Must be used alongside dstClientId. |
| --facet            | [string]                                   | Export content matching the given facets.<br />Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values.<br />A regex can be provided for text filters, surrounded with forward slashes.<br />For more examples, see [facets](#FACETS). |
| --mapFile          | [string]                                   | Mapping file to use when updating content that already exists.<br />Updated with any new mappings that are generated. If not present, will be created.<br />For more information, see [mapping files](#MAPPING-FILES). |
| -f<br />--force    | [boolean]                                  | Overwrite content, create and assign content types, and ignore content with missing types/references without asking. |
| -v<br />--validate | [boolean]                                  | Only recreate folder structure - content is validated but not imported. |
| --skipIncomplete   | [boolean]                                  | Skip any content item that has one or more missing dependancy. |
| --lastPublish      | [boolean]                                  | When available, export the last published version of a content item rather than its newest version. |
| --publish          | [boolean]                                  | Publish any content items that have an existing publish status in their JSON. |
| --republish        | [boolean]                                  | Republish content items regardless of whether the import changed them or not.<br />(--publish not required) |
| --excludeKeys      | [boolean]                                  | Exclude delivery keys when importing content items.          |
| --media            | [boolean]                                  | Detect and rewrite media links to match assets in the target account's DAM.<br />Your client must have DAM permissions configured. |
| --logFile          | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Copy content with destination credentials in config file

`dc-cli content-item copy ./myDirectory/content`

##### Specify a mapping file when copying

`dc-cli content-item copy ./myDirectory/content --mapFile ./myDirectory/mappingFile.json`

##### Copy content wihout destination credentials in config file

`dc-cli content-item copy ./myDirectory/content --dstClientId foo --dstSecret bar --dstHubId baz`

### move

Exports content items from the source hub and imports it into the destination hub with a single command. Content items in the source hub are archived after the successful move.

Before moving content you must ensure that a valid [content type](#CONTENT-TYPE.md) exists in the destination hub for each content item.

```
dc-cli content-item move <dir>
```

#### Options

| Option Name        | Type                                       | Description                                                  |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| --revertLog        | [string]                                   | Path to a log file to revert a copy for.<br />This will archive the most recently copied resources, and revert updated ones. |
| --srcRepo          | [string]                                   | Copy content from within a given repository.<br />Directory structure will start at the specified repository.<br />Will automatically export all contained folders. |
| --srcFolder        | [string]                                   | Copy content from within a given folder.<br />Directory structure will start at the specified folder.<br />Can be used in addition to repoId. |
| --dstRepo          | [string]                                   | Copy matching the given repository to the source base directory, by ID.<br />Folder structure will be followed and replicated from there. |
| --dstFolder        | [string]                                   | Copy matching the given folder to the source base directory, by ID.<br />Folder structure will be followed and replicated from there. |
| --dstHubId         | [string]                                   | Destination hub ID.<br />If not specified, it will be the same as the source. |
| --dstClientId      | [string]                                   | Destination account's client ID.<br />If not specified, it will be the same as the source. |
| --dstSecret        | [string]                                   | Destination account's secret.<br />Must be used alongside dstClientId. |
| --facet            | [string]                                   | Export content matching the given facets.<br />Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values.<br />A regex can be provided for text filters, surrounded with forward slashes.<br />For more examples, see [facets](#FACETS). |
| --mapFile          | [string]                                   | Mapping file to use when updating content that already exists.<br />Updated with any new mappings that are generated. If not present, will be created.<br />For more information, see [mapping files](#MAPPING-FILES). |
| -f<br />--force    | [boolean]                                  | Overwrite content, create and assign content types, and ignore content with missing types/references without asking. |
| -v<br />--validate | [boolean]                                  | Only recreate folder structure - content is validated but not imported. |
| --skipIncomplete   | [boolean]                                  | Skip any content item that has one or more missing dependancy. |
| --lastPublish      | [boolean]                                  | When available, export the last published version of a content item rather than its newest version. |
| --publish          | [boolean]                                  | Publish any content items that have an existing publish status in their JSON. |
| --republish        | [boolean]                                  | Republish content items regardless of whether the import changed them or not.<br />(--publish not required) |
| --excludeKeys      | [boolean]                                  | Exclude delivery keys when importing content items.          |
| --media            | [boolean]                                  | Detect and rewrite media links to match assets in the target account's DAM.<br />Your client must have DAM permissions configured. |
| --logFile          | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Move content with destination credentials in config file

`dc-cli content-item move ./myDirectory/content`

##### Specify a mapping file when moving

`dc-cli content-item move ./myDirectory/content --mapFile ./myDirectory/mappingFile.json`

##### Move content wihout destination credentials in config file

`dc-cli content-item move ./myDirectory/content --dstClientId foo --dstSecret bar --dstHubId baz`

### archive

Archives content items in the targeted Dynamic Content hub.

```
dc-cli content-item archive [id]
```

#### Options

| Option Name                     | Type                                       | Description                                                  |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| --repoId                        | [string]                                   | The ID of a content repository to search items in to be archived. |
| --folderId                      | [string]                                   | The ID of a folder to search items in to be archived.        |
| --facet                         | [string]                                   | Export content matching the given facets.<br />Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values.<br />A regex can be provided for text filters, surrounded with forward slashes.<br />For more examples, see [facets](#FACETS). |
| --name<br />*(Deprecated)*      | [string]                                   | The name of a Content Item to be archived.<br/>A regex can be provided to select multiple items with similar or matching names (eg /.header/).<br/>A single --name option may be given to match a single content item pattern.<br/>Multiple --name options may be given to match multiple content items patterns at the same time, or even multiple regex.<br /><br />Deprecated by the [--facet](#facets) option. |
| --contentType<br />(Deprecated) | [string]                                   | A pattern which will only archive content items with a matching Content Type Schema ID.<br/>A single --contentType option may be given to match a single schema id pattern.<br/>Multiple --contentType options may be given to match multiple schema patterns at the same time.<br /><br />Deprecated by the [--facet](#facets) option. |
| --revertLog                     | [string]                                   | Path to a log file containing content items unarchived in a previous run of the unarchive command.<br/>When provided, archives all content items listed as UNARCHIVE in the log file. |
| -f<br />--force                 | [boolean]                                  | If present, there will be no confirmation prompt before archiving the found content. |
| -s<br />--silent                | [boolean]                                  | If present, no log file will be produced.                    |
| --ignoreError                   | [boolean]                                  | If present, archive requests that fail will not abort the process. |
| --logFile                       | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Archive all content items in a hub

`dc-cli content-item archive`

##### Archive all content items from a specific repository

`dc-cli content-item archive --repoId 111111111111111111111111`

##### Archive all content items with the "banner" schema type, with "Christmas" in their name

`dc-cli content-item archive --facet "schema:/.+banner.json$/,name:/Christmas/"`

### unarchive

Unarchives content items in the targeted Dynamic Content hub.

```
dc-cli content-item unarchive [id]
```

#### Options

| Option Name                     | Type                                       | Description                                                  |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| --repoId                        | [string]                                   | The ID of a content repository to search items in to be unarchived. |
| --folderId                      | [string]                                   | The ID of a folder to search items in to be unarchived.      |
| --facet                         | [string]                                   | Export content matching the given facets.<br />Provide facets in the format 'label:example name,locale:en-GB', spaces are allowed between values.<br />A regex can be provided for text filters, surrounded with forward slashes.<br />For more examples, see [facets](#FACETS). |
| --name<br />*(Deprecated)*      | [string]                                   | The name of a Content Item to be unarchived.<br/>A regex can be provided to select multiple items with similar or matching names (eg /.header/).<br/>A single --name option may be given to match a single content item pattern.<br/>Multiple --name options may be given to match multiple content items patterns at the same time, or even multiple regex.<br /><br />Deprecated by the [--facet](#facets) option. |
| --contentType<br />(Deprecated) | [string]                                   | A pattern which will only unarchive content items with a matching Content Type Schema ID.<br/>A single --contentType option may be given to match a single schema id pattern.<br/>Multiple --contentType options may be given to match multiple schema patterns at the same time.<br /><br />Deprecated by the [--facet](#facets) option. |
| --revertLog                     | [string]                                   | Path to a log file containing content items archived in a previous run of the archive command.<br/>When provided, archives all content items listed as ARCHIVE in the log file. |
| -f<br />--force                 | [boolean]                                  | If present, there will be no confirmation prompt before unarchiving the found content. |
| -s<br />--silent                | [boolean]                                  | If present, no log file will be produced.                    |
| --ignoreError                   | [boolean]                                  | If present, unarchive requests that fail will not abort the process. |
| --logFile                       | [string]<br />[default: (generated-value)] | Path to a log file to write to.                              |

#### Examples

##### Unarchive all content items in a hub

`dc-cli content-item unarchive`

##### Unarchive all content items from a specific repository

`dc-cli content-item unarchive --repoId 111111111111111111111111`

##### Unarchive all content items with the "banner" schema type, with "Christmas" in their name

`dc-cli content-item unarchive --facet "schema:/.+banner.json$/,name:/Christmas/"`

### tree

Print a dependency tree for any folder of content items on your system. The input directory should contain content items in the same format that the [export](#export) command generates. This is useful for examining the dependency structure of content that has been created, and identifying potential problems you might encounter when importing content items to a hub.

```
dc-cli content-item tree <dir>
```

#### Options

The tree command only uses [common options](#Common Options)

#### Examples

##### Generate a content item tree for a filesystem directory

`dc-cli content-item tree ./myDirectory/content`

### publish

Snapshots and publishes content-items.

#### Examples

##### Publish a batch of content-items specified by the facet

`dc-cli content-item publish --facet "schema:/Teaser|Homepage/" --repoId aaa11122aaff333ff22ff`

### workflow

Updates the workflow of the content-items to the target workflow.

#### Examples

##### Update the workflow of a batch of content-items specified by the facet

`dc-cli content-item workflow --targetWorkflowLabel "Ready For Translation" --facet "schema:/Teaser|Homepage/" --repoId aaa11122aaff333ff22ff`
