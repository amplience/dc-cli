# event

## Description

The **event** category includes interactions with Dynamic Content's events and its constituent parts (Editions, Slots, and Snapshots). These commands can be used to export and import events, and to archive events.

Run `dc-cli event --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Useful Information](#useful-information)
	- [Export & Import limitations](#export--import-limitations)
	- [Mapping files](#mapping-files)
	
- [Commands](#commands)
  - [archive](#archive)
  - [export](#export)
  - [import](#import)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **event** commands.

| Option Name    | Type                                                       | Description                      |
| -------------- | ---------------------------------------------------------- | -------------------------------- |
| --version      | [boolean]                                                  | Show version number              |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub     |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub        |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file         |
| --help         | [boolean]                                                  | Show help                        |
| --logFile      | [string]<br />[default: (generated-value)]                 | Path to a log file to write to.  |

## Useful Information

### Export & Import limitations

When exporting and importing events with the DC CLI, it is important to understand that these commands have some limitations in regards to the snapshot components of events.

Events, Editions, and Slots will be exported and imported much like with the other export and import commands in the CLI. However the most granular part of an event in Dynamic Content, the Snapshot, is a representation of a content item exactly as it appears at the point when it was added to an edition using the content browser, or when it was saved to an edition in the production view.

Due to this nature of snapshots, the event import command will not always result in an exact copy of the events exported with the event export command. Whilst the properties of the parent edition and event will match those of the source, the snapshots will be created as new. If a snapshotted content item in the source hub's exported events have been updated since the snapshot was created, then it will be the updated version of that content item which will be created as snapshots in the destination hub.

Snapshots can still optionally be exported to your file system by passing the `--snapshots` argument with your export command, however these will not be used during import and would only be used for reference purposes.

The below table details what will and will not be included with the export and import commands:

| Component | Exported with `export` command?               | Imported with `import` command?                              |
| --------- | --------------------------------------------- | ------------------------------------------------------------ |
| Events    | Yes                                           | Yes                                                          |
| Editions  | Yes                                           | Yes                                                          |
| Slots     | Yes                                           | Yes                                                          |
| Snapshots | Yes*<br /><br />(With `--snapshots` argument) | No<br /><br />Snapshots are always created from the latest version of content items in the destination hub. |

If you accept the above limitations and wish use the import command, you must pass the `--acceptSnapshotLimits` argument along with any others.

### Mapping files

When importing events with the DC CLI, this creates or references a mapping file to determine whether the imported event should be created as new, or if an existing one within the Dynamic Content platform should be updated.

For example exporting an event (eg `111111111111111111111111`) from one hub then importing it to another for the first time will create a new event with a randomly generated UUID (eg `222222222222222222222222`). 

To instruct the DC CLI on which event to update with future actions, a mapping between the source and destination is stored in a mapping file. This mapping file will contain an array of every event mapping identified for jobs using that mapping file, along with its constituent parts (editions, slots, and snapshots). Using the previous examples:

```
{
	"contentItems": [
		[
			"111111111111111111111111",
			"222222222222222222222222"
		]
	],
	"workflowStates": [],
	"events": [
		[
			"111111111111111111111111",
			"222222222222222222222222"
		]
	],
	"editions": [
		[
			"111111111111111111111111",
			"222222222222222222222222"
		]
	],
	"slots": [
		[
			"111111111111111111111111",
			"222222222222222222222222"
		]
	],
	"snapshots": [
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

If a mapping file does not exist at the point of import, then any imported events will be created as new, and a new mapping file will be created. If a mapping file exists, and was provided with the `--mapFile` argument, then any events found within the mapping file will be updated. Any events not contained in the mapping file will will be created as new, and will then be added to the mapping file.

Content items referenced within your events' slots are not imported with the `event import` command, and will need to exist in the destination hub beforehand. Content item references will be reliant on existing mappings from a previous [content item](CONTENT-ITEM.md) import, though the command will try to look up the original content item IDs if no mapping is present (for same hub export/import use cases).

## Commands

### archive

Archives events and their child edition in the targeted Dynamic Content hub, and will also unschedule them if they have not yet started.

This command requires either an event ID or name to filter, and will not archive any events if no filter is provided.

```
dc-cli event archive [id]
```

#### Options

| Option Name       | Type      | Description                                                  |
| ----------------- | --------- | ------------------------------------------------------------ |
| --name            | [string]  | The name of an Event to be archived.<br/>A regex can be provided to select multiple items with similar or matching names (eg /.header/).<br/>A single --name option may be given to match a single event pattern.<br/>Multiple --name options may be given to match multiple events' patterns at the same time, or even multiple regex. |
| -f,<br />--force  | [boolean] | If present, there will be no confirmation prompt before archiving the found content. |
| -s,<br />--silent | [boolean] | If present, no log file will be produced.                    |

#### Examples

##### Archive event with the ID of "foo"

`dc-cli event archive foo`

##### Archive all events with "Christmas" in their name

`dc-cli event archive --name "/Christmas/"`

### export

Exports events from the targeted Dynamic Content hub into the specified filesystem location.

We recommend reading about [snapshots and DC CLI](#snapshots-and-dc-cli) before exporting or importing events.

```
dc-cli event export <dir>
```

#### Options

| Option Name | Type      | Description                                                  |
| ----------- | --------- | ------------------------------------------------------------ |
| --id        | [string]  | Export a single event by ID, rather then fetching all of them. |
| --fromDate  | [string]  | Start date for filtering events.<br />Either "NOW" or in the format "\<number\>:\<unit\>", example: "-7:DAYS". |
| --toDate    | [string]  | To date for filtering events.<br />Either "NOW" or in the format "\<number\>:\<unit\>", example: "-7:DAYS". |
| --snapshots | [boolean] | Save content snapshots with events, in subfolder "snapshots/". |

#### Examples

##### Export all events from a Hub

`dc-cli event export ./myDirectory/event`

##### Export all events which start 7 days from now from a Hub

`dc-cli event export ./myDirectory/event --fromDate "+7:DAYS"`

### import

Imports events from the specified filesystem location to the targeted Dynamic Content hub.

We recommend reading about [snapshots and DC CLI](#snapshots-and-dc-cli) before exporting or importing events.

Before importing events you must ensure that a valid [content item](#CONTENT-ITEM.md) exists in the destination hub for each content item contained within each event, and contains an appropriate mapping within the [mapping file](#mapping-files).

```
dc-cli event import <dir>
```

#### Options

| Option Name            | Type      | Description                                                  |
| ---------------------- | --------- | ------------------------------------------------------------ |
| --acceptSnapshotLimits | [boolean] | Must be passed to use the event import command.<br />Only use this command if you fully understand its [limitations](#export--import-limitations). |
| --mapFile              | [string]  | Mapping file to use when updating content that already exists.<br />Updated with any new mappings that are generated.<br />If not present, will be created.<br />For more information, see [mapping files](#MAPPING-FILES). |
| -f<br />--force        | [boolean] | Overwrite existing events, editions, slots and snapshots without asking. |
| --schedule             | [boolean] | Schedule events in the destination repo if they are scheduled in the source.<br />If any new or updated scheduled events started in the past, they will be moved to happen at the time of import.<br />If they ended in the past, they will be skipped by default. |
| --catchup              | [boolean] | Scheduling events that ended in the past will move to the current date, so that their publishes run. |
| --originalIds          | [boolean] | Use original IDs.                                            |

#### Examples

##### Import events from the filesystem

`dc-cli event import ./myDirectory/event --acceptSnapshotLimits`

##### Specify a mapping file when importing

`dc-cli event import ./myDirectory/event --mapFile ./myDirectory/mappingFile.json --acceptSnapshotLimits`