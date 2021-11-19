# settings

## Description

The **settings** command category includes interactions with the supporting properties of a Dynamic Content hub. These commands can be used to export and import a hub's breakpoint settings for visualization, preview applications, workflow states, and locales.

Run `dc-cli settings --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Useful information](#useful-information)
    - [Mapping files](#mapping-files)
- [Commands](#commands)
    - [export](#export)
    - [import](#import)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **settings** commands.

| Option Name    | Type                                                       | Description                      |
| -------------- | ---------------------------------------------------------- | -------------------------------- |
| --version      | [boolean]                                                  | Show version number              |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub     |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub        |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file         |
| --help         | [boolean]                                                  | Show help                        |
| --logFile      | [string]<br />[default: (generated-value)]                 | Path to a log file to write to.  |

## Useful information

### Mapping files

When importing workflow states from with the DC CLI, this creates or references a mapping file to determine whether a new workflow state should be created, or if an existing one should be updated.

For example exporting a workflow state (eg `111111111111111111111111`) from one hub then importing it to another for the first time will create a new workflow state with a randomly generated UUID (eg `222222222222222222222222`). 

To instruct the DC CLI on which workflow state to update with future actions, a mapping between the source and destination is stored in a mapping file. This mapping file will contain an array of every workflow state mapping identified for jobs using that mapping file. Using the previous examples:

```
{
    "contentItems": [],
    "workflowStates": [
        [
            "111111111111111111111111",
            "222222222222222222222222"
        ]
    ]
}
```

If no mapping file is specified (with the `--mapFile` argument) then a default one will be created or updated, using the destination's resource type (hub) and its ID, and stored within a default location in your user directory. For example:

* Mac: `~/.amplience/imports/hub-111111111111111111111111.json`
* Windows: `%UserProfile%\.amplience\imports\hub-111111111111111111111111.json`

If a mapping file does not exist at the point of import, then any imported workflow states will be created as new, and a new mapping file will be created. If a mapping file exists, and was provided with the `--mapFile` argument, then any workflow states found within the mapping file will be updated. Any workflow states not contained in the mapping file will will be created as new, and will then be added to the mapping file.

## Commands

### export

Exports the hub's settings from the targeted Dynamic Content hub into the specified filesystem location.

```
dc-cli settings export <dir>
```

#### Options

| Option Name     | Type      | Description                                                  |
| --------------- | --------- | ------------------------------------------------------------ |
| -f<br />--force | [boolean] | Overwrite settings when writing to the filesystem without asking. |

#### Examples

##### Export settings from a Hub

`dc-cli settings export ./myDirectory/settings`

### import

Imports a hub's settings from the specified filesystem location to the targeted Dynamic Content hub.

```
dc-cli settings import <dir>
```

#### Options

| Option Name     | Type      | Description                                                  |
| --------------- | --------- | ------------------------------------------------------------ |
| --mapFile       | [string]  | Mapping file to use when updating workflow states that already exists.<br />Updated with any new mappings that are generated.<br />If not present, will be created.<br />For more information, see [mapping files](#MAPPING-FILES). |
| -f<br />--force | [boolean] | Overwrite workflow states on import without asking.          |

#### Examples

##### Import settings the filesystem

`dc-cli settings import ./myDirectory/settings`

##### Specify a mapping file when importing

`dc-cli settings import ./myDirectory/settings --mapFile ./myDirectory/mappingFile.json`