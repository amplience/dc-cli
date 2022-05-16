# hub

## Description

The **hub** command category includes interactions with Dynamic Content's hubs in their entirety.

These commands can be used to copy a hub's settings and content in their entirety to another hub, or to archive all parts of a hub which can be archived. 

Run `dc-cli hub --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Useful Information](#useful-information)
    - [Mapping files](#mapping-files)
    - [Media-link rewriting](#media-link-rewriting)
- [Commands](#commands)
    - [clone](#clone)
    - [clean](#clean)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **hub** commands.

| Option Name     | Type                                                       | Description                                                  |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| --version       | [boolean]                                                  | Show version number                                          |
| --clientId      | [string]<br />[required]                                   | Client ID for the source hub                                 |
| --clientSecret  | [string]<br />[required]                                   | Client secret for the source hub                             |
| --hubId         | [string]<br />[required]                                   | Hub ID for the source hub                                    |
| --config        | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file                                     |
| --help          | [boolean]                                                  | Show help                                                    |
| -f<br />--force | [boolean]                                                  | Overwrite content, create and assign content types, and ignore content with missing types/references without asking. |
| --logFile       | [string]<br />[default: (generated-value)]                 | Path to a log file to write to.                              |

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

If no mapping file is specified (with the `--mapFile` argument) then a default one will be created or updated, using the destination's resource type (hub) and its ID, and stored within a default location in your user directory. For example:

* Mac: `~/.amplience/imports/hub-111111111111111111111111.json`
* Windows: `%UserProfile%\.amplience\imports\hub-111111111111111111111111.json`

If a mapping file does not exist at the point of import, then any imported content items will be created as new, and a new mapping file will be created. If a mapping file exists, and was provided with the `--mapFile` argument, then any items found within the mapping file will be updated. Any content items not contained in the mapping file will will be created as new, and will then be added to the mapping file.

### Media-link rewriting

The DC CLI is capable of importing or copying content into a Dynamic Content hub which resides on a distinct Content Hub account to the source by using the `--media` option with the clone command. This will update the `endpoint`, `id`, and `defaultHost` values for any `media-link` objects to reflect the endpoint of the destination hub's account, if an asset with a matching name exists in the destination account.

This functionality requires additional Content Hub-specific permissions granting to your DC CLI client in order to grant it visibility of the destination account's media assets (`DAM:ASSET STORE:ASSET_STORE_NAME`).

## Commands

### clone

Exports all of the following (where applicable) from the source hub, then imports them into the destination hub:

* Hub Settings
* Extensions
* Content Type Schemas
* Content Types
* Content Items
* Search Indexes
* Events (requires `--acceptSnapshotLimits` argument, due to some [limitations](EVENT.md#export--import-limitations))

```
dc-cli hub clone <dir>
```

#### Options

| Option Name            | Type                                                         | Description                                                  |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| --acceptSnapshotLimits | [boolean]                                                    | Must be passed to use the event clone step.<br />Only use this command if you fully understand its [limitations](EVENT.md#export--import-limitations). |
| --dstHubId             | [string]                                                     | Destination hub ID.<br />If not specified, it will be the same as the source. |
| --dstClientId          | [string]                                                     | Destination account's client ID.<br />If not specified, it will be the same as the source. |
| --dstSecret            | [string]                                                     | Destination account's secret.<br />Must be used alongside dstClientId. |
| --mapFile              | [string]                                                     | Mapping file to use when updating content that already exists.<br />Updated with any new mappings that are generated. If not present, will be created. |
| -v<br />--validate     | [boolean]                                                    | Only recreate folder structure.<br />Content is validated but not imported. |
| --skipIncomplete       | [boolean]                                                    | Skip any content item that has one or more missing dependancy. |
| --lastPublish          | [boolean]                                                    | When available, export the last published version of a content item rather than its newest version. |
| --publish              | [boolean]                                                    | Publish any content items that have an existing publish status in their JSON. |
| --republish            | [boolean]                                                    | Republish content items regardless of whether the import changed them or not.<br />(--publish not required) |
| --excludeKeys          | [boolean]                                                    | Exclude delivery keys when importing content items.          |
| --media                | [boolean]                                                    | Detect and rewrite media links to match assets in the target account's DAM.<br />Your client must have DAM permissions configured. |
| --revertLog            | [string]                                                     | Revert a previous clone using a given revert log and given directory.<br />Reverts steps in reverse order, starting at the specified one. |
| --step                 | [string]<br />[choices: "settings", "schema", "type", "content"] | Start at a specific step.<br />Steps after the one you specify will also run. |

#### Examples

##### Clone hub from scratch

`dc-cli hub clone ./myDirectory/hub`

##### Clone hub with events

`dc-cli hub clone ./myDirectory/hub --acceptSnapshotLimits`

##### Resume a hub clone from the content item step

`dc-cli hub clone ./myDirectory/hub --step content`

### clean

Archives all of the following (where applicable) from the source hub:

* Hub Settings
* Content Type Schemas
* Content Types
* Content Items

```
dc-cli hub clean
```

#### Options

| Option Name | Type                                                 | Description                                                  |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| --step      | [string]<br />[choices: "content", "type", "schema"] | Start at a specific step.<br />Steps after the one you specify will also run. |

#### Examples

##### Start off the clean hub process

`dc-cli hub clean`

##### Resume the clean hub process from the content item step

`dc-cli hub clean --step content`