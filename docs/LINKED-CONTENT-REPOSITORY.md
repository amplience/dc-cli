# linked-content-repository

## Description

The **linked-content-repository** command category includes a number of interactions with linked content respositories.

Run `dc-cli linked-content-repository --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [linked-content-repository](#linked-content-repository)
  - [Description](#description)
  - [Common Options](#common-options)
  - [Commands](#commands)
    - [list](#list)
      - [Options](#options)
      - [Examples](#examples)
        - [List all linked content repositories](#list-all-linked-content-repositories)
    - [update](#update)
      - [Options](#options-1)
      - [Examples](#examples-1)
        - [List all linked content repositories](#list-all-linked-content-repositories-1)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **linked-content-repository** commands.

| Option Name | Type                                                       | Description               |
| ----------- | ---------------------------------------------------------- | ------------------------- |
| --version   | [boolean]                                                  | Show version number       |
| --patToken  | [string]<br />[required]                                   | PAT for the source hub    |
| --hubId     | [string]<br />[required]                                   | Hub ID for the source hub |
| --config    | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file  |
| --help      | [boolean]                                                  | Show help                 |

## Commands

### list

List linked content repositories that exist in the target hubs Organization.

```
dc-cli linked-content-repository list
```

#### Options

| Option Name | Type                            | Description                                               |
| ----------- | ------------------------------- | --------------------------------------------------------- |
| --sort      | [string]                        | How to order the list e.g "\<property\>,\<asc\|desc\>..." |
| --json      | [boolean]<br />[default: false] | Render output as JSON                                     |

#### Examples

##### List all linked content repositories

`dc-cli linked-content-repository list`

### update

Update a linked content repository.

```
dc-cli linked-content-repository update
```

#### Options

| Option Name | Type                            | Description                                           |
| ----------- | ------------------------------- | ----------------------------------------------------- |
| --file      | [string] <br />[required]       | Path to file containing link content respository JSON |
| --json      | [boolean]<br />[default: false] | Render output as JSON                                 |

#### Examples

##### List all linked content repositories

`dc-cli linked-content-repository update --file '/User/Ampy/my-linked-content-repository-to-update.json'`
