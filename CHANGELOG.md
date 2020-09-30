# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.6.0](https://github.com/amplience/dc-cli/compare/v0.5.0...v0.6.0) (2020-09-30)


### Features

* **content-item:** import/export content item commands ([121761c](https://github.com/amplience/dc-cli/commit/121761c))

## [0.5.0](https://github.com/amplience/dc-cli/compare/v0.4.0...v0.5.0) (2020-08-21)


### Features

* archive/unarchive for content types and content type schema ([#57](https://github.com/amplience/dc-cli/issues/57)) ([67935bf](https://github.com/amplience/dc-cli/commit/67935bf))

## [0.4.0](https://github.com/amplience/dc-cli/compare/v0.3.0...v0.4.0) (2020-03-11)


### Bug Fixes

* **readme:** changed --clientKey to --clientId ([#50](https://github.com/amplience/dc-cli/issues/50)) ([79eee8b](https://github.com/amplience/dc-cli/commit/79eee8b))


### Features

* **json schema 7 support:** added support for json schema draft 7 an… ([#47](https://github.com/amplience/dc-cli/issues/47)) ([f8cc75d](https://github.com/amplience/dc-cli/commit/f8cc75d))

## [0.3.0](https://github.com/amplience/dc-cli/compare/v0.2.0...v0.3.0) (2019-12-11)


### Bug Fixes

* **cli script name:** the script name is defined as dc-cli on windows ([48da1df](https://github.com/amplience/dc-cli/commit/48da1df))
* **content-type-schema import:** the import results table now displays what is returned from the api ([9cac69d](https://github.com/amplience/dc-cli/commit/9cac69d))


### Features

* **content type schemas:** export command ([#37](https://github.com/amplience/dc-cli/issues/37)) ([3b7db6b](https://github.com/amplience/dc-cli/commit/3b7db6b))
* **content types:** export command ([#36](https://github.com/amplience/dc-cli/issues/36)) ([e4e1f7a](https://github.com/amplience/dc-cli/commit/e4e1f7a))

## [0.2.0](https://github.com/amplience/dc-cli/compare/v0.1.0...v0.2.0) (2019-11-20)


### Features

* **import content types:** supports content-type-schemas, content-types & repository assign/unassign ([7de098f](https://github.com/amplience/dc-cli/commit/7de098f))

## 0.1.0 (2019-11-07)


### Bug Fixes

* **command option args:** enforce reqired args have values and all positional args are required ([7ac34ca](https://github.com/amplience/dc-cli/commit/7ac34ca))
* **content type command:** fixing merge issues ([6a27c35](https://github.com/amplience/dc-cli/commit/6a27c35))
* **content type schema list:** fix error when schema list is empty ([37f9b3a](https://github.com/amplience/dc-cli/commit/37f9b3a))
* **content type schema list:** removing option to sort content type schemas ([00a45fa](https://github.com/amplience/dc-cli/commit/00a45fa))
* **positional yargs:** making positional id's required ([8944ee5](https://github.com/amplience/dc-cli/commit/8944ee5))
* **sorting strings:** changed the sort to order larger numbers correctly ([8687a4d](https://github.com/amplience/dc-cli/commit/8687a4d))
* **style:** fix formatting ([dd13bc0](https://github.com/amplience/dc-cli/commit/dd13bc0))


### Features

* **auto pagination:** all list commands now return all items and paginate automatically ([7560645](https://github.com/amplience/dc-cli/commit/7560645))
* **cli entrypoint:** updated index to use a cli entrypoint ([444d442](https://github.com/amplience/dc-cli/commit/444d442))
* **config:** ability to read from a global config file and updated tests ([98748dd](https://github.com/amplience/dc-cli/commit/98748dd))
* **content repositories:** added functionality to unassign a content type along with tests ([118b486](https://github.com/amplience/dc-cli/commit/118b486))
* **content repositories:** implementing content repositories get command ([b1403bc](https://github.com/amplience/dc-cli/commit/b1403bc))
* **content respositories:** added functionality and tests for assigning a content type ([a27f456](https://github.com/amplience/dc-cli/commit/a27f456))
* **content type:** adding register content type command ([14ee22e](https://github.com/amplience/dc-cli/commit/14ee22e))
* **content type:** adding root content type command ([a24b914](https://github.com/amplience/dc-cli/commit/a24b914))
* **content type command:** adding ability to update content types ([12500ca](https://github.com/amplience/dc-cli/commit/12500ca))
* **content type schema:** adding basic list commands for content type schemas ([6a675aa](https://github.com/amplience/dc-cli/commit/6a675aa))
* **content type schema create:** create content type schema tests ([03f1166](https://github.com/amplience/dc-cli/commit/03f1166))
* **content type schema sync:** added functionality for the new command ([87ae68f](https://github.com/amplience/dc-cli/commit/87ae68f))
* **content type schema update:** ability to update a content type schema ([e1ff155](https://github.com/amplience/dc-cli/commit/e1ff155))
* **content type schema update:** merge changes ([0f2bfbd](https://github.com/amplience/dc-cli/commit/0f2bfbd))
* **content type schemas:** adding page data to output ([aa99f2d](https://github.com/amplience/dc-cli/commit/aa99f2d))
* **content type update:** adding cards option to content type update ([fa5bf1a](https://github.com/amplience/dc-cli/commit/fa5bf1a))
* **content-repo:** update commands to be 'command [id]' ([d53ed59](https://github.com/amplience/dc-cli/commit/d53ed59))
* **content-repositories:** list command ([7587bff](https://github.com/amplience/dc-cli/commit/7587bff))
* **content-type:** list command ([4d5a5ca](https://github.com/amplience/dc-cli/commit/4d5a5ca))
* **content-type list:** list support ([97e7e5c](https://github.com/amplience/dc-cli/commit/97e7e5c))
* **content-type-schema:** get a content-type-schema support ([71712d6](https://github.com/amplience/dc-cli/commit/71712d6))
* **content-type-schema:** help command is returned when no additional command is supplied ([f3401ab](https://github.com/amplience/dc-cli/commit/f3401ab))
* **content-type-schema:** removed the required for --id for get command ([ec75d53](https://github.com/amplience/dc-cli/commit/ec75d53))
* **content-type-schema:** updated "update" command to use a id positional like "get" ([b0988ef](https://github.com/amplience/dc-cli/commit/b0988ef))
* **content-type-schema create:** create content type schema ([0baea35](https://github.com/amplience/dc-cli/commit/0baea35))
* **data presenter:** added tests ([34ea131](https://github.com/amplience/dc-cli/commit/34ea131))
* **error handling:** errors are now reported without the stack trace ([f5ba099](https://github.com/amplience/dc-cli/commit/f5ba099))
* **error message:** added error messages for http status code 400, 401, 403, 429 & 500 ([d2b1061](https://github.com/amplience/dc-cli/commit/d2b1061))
* **error-handling:** udpated the forbidden error to look like the permission error from dc sdk ([b1bf7dd](https://github.com/amplience/dc-cli/commit/b1bf7dd))
* **positional id:** added missing positional id to content type get command ([daf0b90](https://github.com/amplience/dc-cli/commit/daf0b90))
* **register content type:** add support for cards ([ad11b3a](https://github.com/amplience/dc-cli/commit/ad11b3a))
* **sequential indexes:** adding testing to ensure indexes are sequential ([cd26092](https://github.com/amplience/dc-cli/commit/cd26092))
* **service:** created initial command line parser service ([fc8b22a](https://github.com/amplience/dc-cli/commit/fc8b22a))
* **yargs object transformer:** added index checking to avoid array overwrites ([e6f8335](https://github.com/amplience/dc-cli/commit/e6f8335))
