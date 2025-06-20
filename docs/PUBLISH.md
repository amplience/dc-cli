# Publish Content Items

Publishes content items to a content hub. You can publish all items or specify individual content items by ID.

## Usage

```bash
dc-cli content-item publish [id]
```

If no `id` is provided, all content items in all content repositories in the specified hub will be published.

---

## Positionals

| Argument | Description                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`     | The ID of a content item to be published. If omitted, all content items in all repositories will be published. _(Optional)_ |

---

## Options

| Option           | Alias | Description                                                                                                                                        |
| ---------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--repoId`       |       | The ID of a content repository to restrict publishing scope. _(Optional)_                                                                          |
| `--folderId`     |       | The ID of a folder to restrict publishing scope. _(Optional)_                                                                                      |
| `--facet`        |       | Filter content using facets. Format: <br>`label:example name,locale:en-GB` <br>Regex supported with `/pattern/`. <br>See README for more examples. |
| `--batchPublish` |       | Enable batch publishing up to 35 items per minute. _(Optional)_                                                                                    |
| `-f`, `--force`  |       | Skip confirmation prompts before publishing.                                                                                                       |
| `-s`, `--silent` |       | Disable log file creation.                                                                                                                         |
| `--logFile`      |       | Path to write the log file. <br>Default: `(log_filename)`                                                                                          |

---

## Examples

### Publish a specific content item by ID

```bash
dc-cli content-item publish 1234abcd
```

### Publish all content in a specific repository

```bash
dc-cli content-item publish --repoId your-repo-id
```

### Use facets to publish filtered content

```bash
dc-cli content-item publish --facet "locale:en-GB,label:homepage"
```

### Batch publish all items silently

```bash
dc-cli content-item publish --batchPublish --silent --force
```
