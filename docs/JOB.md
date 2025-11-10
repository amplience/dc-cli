# job

## Description

This category includes interactions with Dynamic Content jobs

Run `dc-cli job --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [job](#job)
  - [Description](#description)
  - [Common Options](#common-options)
  - [Commands](#commands)
    - [get](#get)
      - [Options](#options)
      - [Examples](#examples)
        - [Get a job by ID](#get-a-job-by-id)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **job** commands.

| Option Name    | Type                                                       | Description                      |
| -------------- | ---------------------------------------------------------- | -------------------------------- |
| --version      | [boolean]                                                  | Show version number              |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub     |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub |
| --patToken     | [string]<br />[required]                                   | PAT for the source hub           |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub        |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file         |
| --help         | [boolean]                                                  | Show help                        |

## Commands

### get

Get a job by ID.

```
dc-cli job get <id>
```

#### Options

| Option Name | Type                            | Description           |
| ----------- | ------------------------------- | --------------------- |
| --json      | [boolean]<br />[default: false] | Render output as JSON |

#### Examples

##### Get a job by ID

`dc-cli job get abc67c23-4c22-4617-a009-0f976d77b789`
