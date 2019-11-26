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
├── 0longqgig.json
├── 71cp2filc.json
├── 9x2iedmyn.json
├── evw68tl08.json
├── ik8nr7yt0.json
├── pokkm8631.json
└── x5ebuhn1n.json

```

Each `.json` file contains a single content type and these files can be used as the input to `content-type import` command.  This allows you to `export` content types from one hub and then `import` these into a different hub.

Note that if the output directory contains a set of files from a previous export then only the files for the changed content types will be updated when running the command.

### Export specified content types from a hub

It is possible to specify the content types to be exported from a hub rather than just exporting all of them using the `--schemaId` option:

```commandline
dc-cli content-type export export/content-types --schemaId "https://raw.githubusercontent.com/amplience/dc-static-blog-nextjs/master/schemas/text.json"

```
This will export just the content type for the `text.json` schema.

Specifying multiple content types at the same time is also possible, for example:

```commandline
dc-cli content-type export export/content-types --schemaId "https://raw.githubusercontent.com/amplience/dc-static-blog-nextjs/master/schemas/blog-slot.json" --schemaId "http://my-content-type-schema.com"

```

## Content Type Schemas

\< TODO \>
