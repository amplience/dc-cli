# content-repository

## Description

The **content-repository** command category includes a number of interactions with Dynamic Content's repositories.

These commands can be used to get details for a specific repository, list multiple repositories, or assign or unassign content types from a repository. 

Run `dc-cli content-repository --help` to get a list of available commands.

Return to [README.md](../README.md) for information on other command categories.

<!-- MarkdownTOC levels="2,3" autolink="true" -->

- [Common Options](#common-options)
- [Commands](#commands)
  - [get](#get)
  - [list](#list)
  - [assign-content-type](#assign-content-type)
  - [unassign-content-type](#unassign-content-type)

<!-- /MarkdownTOC -->

## Common Options

The following options are available for all **content-repository** commands.

| Option Name    | Type                                                       | Description                      |
| -------------- | ---------------------------------------------------------- | -------------------------------- |
| --version      | [boolean]                                                  | Show version number              |
| --clientId     | [string]<br />[required]                                   | Client ID for the source hub     |
| --clientSecret | [string]<br />[required]                                   | Client secret for the source hub |
| --hubId        | [string]<br />[required]                                   | Hub ID for the source hub        |
| --config       | [string]<br />[default: "~/.amplience/dc-cli-config.json"] | Path to JSON config file         |
| --help         | [boolean]                                                  | Show help                        |

## Commands

### get

Returns information for a single content repository. Returns name, label, assigned content types, repository type, and repository locales. 

```
dc-cli content-repository get <id>
```

#### Options

| Option Name | Type                            | Description           |
| ----------- | ------------------------------- | --------------------- |
| --json      | [boolean]<br />[default: false] | Render output as JSON |

#### Examples

##### Get details for specific repository with ID of 'foo'

`dc-cli content-repository get foo`

### list

Returns information for a all content repositories in the target hub. Returns name, label, assigned content types, features, and repository locales. 

```
dc-cli content-repository list
```

#### Options

| Option Name | Type                            | Description                                                  |
| ----------- | ------------------------------- | ------------------------------------------------------------ |
| --sort      | [string]                        | How to order the list.<br />e.g "\<property\>,\<asc\|desc\>..." |
| --json      | [boolean]<br />[default: false] | Render output as JSON                                        |

#### Examples

##### List all repositories

`dc-cli content-repository list`

##### List all repositories sorted ascending by label

`dc-cli content-repository list --sort "label,asc"`

### assign-content-type

Adds an association between a specified content type and a specified content repository, making it available for production in the Dynamic Content UI.

```
dc-cli content-repository assign-content-type <id>
```

#### Options

| Option Name     | Type                            | Description               |
| --------------- | ------------------------------- | ------------------------- |
| --contentTypeId | [string]<br />[required]        | Content Type ID to assign |
| --json          | [boolean]<br />[default: false] | Render output as JSON     |

#### Examples

##### Create assignment between repository 'foo' and content type 'bar'

`dc-cli content-repository assign-content-type foo --contentTypeId bar`

### unassign-content-type

Removes the association between a specified content type and a specified content repository, making it unavailable for production in the Dynamic Content UI.

```
dc-cli content-repository unassign-content-type <id>
```

#### Options

| Option Name     | Type                            | Description                 |
| --------------- | ------------------------------- | --------------------------- |
| --contentTypeId | [string]<br />[required]        | Content Type ID to unassign |
| --json          | [boolean]<br />[default: false] | Render output as JSON       |

#### Examples

##### Remove assignment between repository 'foo' and content type 'bar'

`dc-cli content-repository unassign-content-type foo --contentTypeId bar`

