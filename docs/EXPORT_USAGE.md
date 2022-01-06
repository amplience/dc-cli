# Export Command Usage
Outlined below are examples of how to use the different types of export commands supported by the CLI. 

For more information on each type use the CLI help command, for example:

```commandline
dc-cli content-type export --help
```

## Content Types

### Export all content types from a hub

To export all of the content types from a hub into a given output directory:

```commandline
mkdir export/content-types
dc-cli content-type export export/content-types

```
The output from this command will create a set of files in the `export/content-types` directory that looks something like this:

```commandline
export/content-types
├── my-content-type-1.json
├── my-content-type-2.json
├── my-content-type-3.json
├── my-content-type-4.json
├── my-content-type-5.json
├── my-content-type-6.json
└── my-content-type-7.json

```

Each `.json` file contains a single content type and these files can be used as the input to `content-type import` command.  This allows you to `export` content types from one hub and then `import` these into a different hub.

Note that if the output directory contains a set of files from a previous export then only the files for the changed content types will be updated when running the command.

### Export specified content types from a hub

It is possible to specify the content types to be exported from a hub rather than just exporting all of them using the `--schemaId` option:

```commandline
dc-cli content-type export export/content-types --schemaId "https://my-content-type-schema.com/schemas/my-content-type-1.json"

```
This will export just the content type for the `my-content-type-1.json` schema.

Specifying multiple content types at the same time is also possible, for example:

```commandline
dc-cli content-type export export/content-types --schemaId "https://my-content-type-schema.com/schemas/my-content-type-1.json" --schemaId "https://my-content-type-schema.com/schemas/my-content-type-2.json"

```

## Content Type Schemas

### Export all content type schemas from a hub

To export all of the content type schemas from a hub into a given output directory:

```commandline
mkdir export/content-type-schemas
dc-cli content-type-schema export export/content-type-schemas

```
The output from this command will create a set of files in the `export/content-type-schemas` directory that looks something like this:

```commandline
export/content-type-schemas
├── my-content-type-schema-1.json
├── my-content-type-schema-2.json
├── my-content-type-schema-3.json
├── my-content-type-schema-4.json
├── my-content-type-schema-5.json
├── my-content-type-schema-6.json
└── my-content-type-schema-7.json

```

Each `.json` file contains a single content type schema and these files can be used as the input to `content-type-schema import` command.  This allows you to `export` content type schemas from one hub and then `import` these into a different hub.

Note that if the output directory contains a set of files from a previous export then only the files for the changed content type schema will be updated when running the command.

### Export specified content type schemas from a hub

It is possible to specify the content type schemas to be exported from a hub rather than just exporting all of them using the `--schemaId` option:

```commandline
dc-cli content-type-schema export export/content-type-schemas --schemaId "https://my-content-type-schema.com/schemas/my-content-type-schema-1.json"

```
This will export the matching content type schema for the `my-content-type-schema-1.json` schemaId.

Specifying multiple schemaId's at the same time is also possible, for example:

```commandline
dc-cli content-type-schema export export/content-type-schemas --schemaId "https://my-content-type-schema.com/schemas/my-content-type-schema-1.json" --schemaId "https://my-content-type-schema.com/schemas/my-content-type-schema-2.json"

```
