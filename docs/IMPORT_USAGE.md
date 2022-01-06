# Import Command Usage

Outlined below are example file structures for the different import commands supported by the CLI.
Each file in a given directory should contain only one type to import.

An example directory structure for content types might look something like this:

```commandline
import/content-types
├── author.json
├── blog-list.json
├── blog-post.json
├── blog-slot.json
├── image.json
├── text.json
└── video.json

0 directories, 7 files
```

For more information on each command use the CLI help command:

```commandline
dc-cli --help
```

## Content Type Schemas

To import content type schemas:

`dc-cli content-type-schema import <<dir>>`

### Schema with relative path file resolution

Creates or updates the supplied content type schemas resolving the body to a relative local path.

`./content-type-schemas/video.json`:
```json
{
  "body": "./schemas/video.json",
  "schemaId": "https://example.com/schemas/video.json",
  "validationLevel": "CONTENT_TYPE"
}
```

For this Content Type Schema to be imported a JSON Schema file must be supplied and stored here  `./content-type-schemas/schemas/video.json` (the file in the body property is relative to the json file)

To import run following:

`dc-cli content-type-schema import ./content-type-schemas/`

### Schema with absolute path file resolution

Creates or updates the supplied content type schemas resolving the body to a absolute local path.

`./content-type-schemas/video.json`:
```json
{
  "body": "file:///schemas/video.json",
  "schemaId": "https://example.com/schemas/video.json",
  "validationLevel": "CONTENT_TYPE"
}
```

For this Content Type Schema to be imported a JSON Schema file must be supplied and stored here  `/schemas/video.json` (the `file://` in the body property denotes an absolute path)

To import run following:

`dc-cli content-type-schema import ./content-type-schemas/`

### Schema with remote file resolution

Creates or updates the supplied content type schemas downloading the body from a remote location.

`./content-type-schema/video.json`:
```json
{
  "body": "https://example.com/schemas/video.json",
  "schemaId": "https://example.com/schemas/video.json",
  "validationLevel": "CONTENT_TYPE"
}
```

For this Content Type Schema to be imported a JSON Schema file must be supplied and accessible via `https://example.com/schemas/video.json` 

To import run following:

`dc-cli content-type-schema import ./content-type-schemas/`


### Schema with a supplied JSON body

Creates or updates the supplied content type schemas with the JSON body supplied.

```json
{
  "body": "{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"$id\":\"https://example.com/schemas/video.json\",\"title\":\"Video\",\"description\":\"Video schema\",\"allOf\":[{\"$ref\":\"http://example.com/content\"}],\"type\":\"object\",\"properties\":{\"video\":{\"title\":\"Video\",\"type\":\"object\",\"anyOf\":[{\"$ref\":\"http://example.com/definitions/video-link\"}]}},\"propertyOrder\":[\"video\"],\"required\":[\"video\"]}",
  "schemaId": "https://example.com/schemas/video.json",
  "validationLevel": "CONTENT_TYPE"
}
```

## Content Types

To import content types:

`dc-cli content-type import <dir>`

To import content types and sync with schemas (useful when updating schemas):

`dc-cli content-type import <dir> --sync`

### Content type only

Creates or updates the supplied content types.

```json
{
  "contentTypeUri": "https://example.com/schemas/video.json",
  "settings": {
    "label": "Example Video",
    "visualizations": [],
    "icons": []
  }
}
```

### Content type with repository assignment/un-assignment

When supplying a list of content repository names, the CLI will assign the content type to the supplied repositories,
skipping the assignment if it is already assigned. If the content type is assigned to a repository that is omitted from the list,
the CLI will unassign the content type from the repository.

```json
{
  "contentTypeUri": "https://example.com/schemas/video.json",
  "settings": {
    "label": "Example Video",
    "visualizations": [],
    "icons": []
  },
  "repositories": ["my-repository"]
}
```
