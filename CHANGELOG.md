# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.15.1](https://www.github.com/amplience/dc-cli/compare/v0.15.0...v0.15.1) (2022-05-26)


### Bug Fixes

* **event:** fix event slots list pagination ([#141](https://www.github.com/amplience/dc-cli/issues/141)) ([d3119aa](https://www.github.com/amplience/dc-cli/commit/d3119aad92e45c6147f463ccf9a54c9608c3ffc7))

## [0.15.0](https://www.github.com/amplience/dc-cli/compare/v0.14.0...v0.15.0) (2022-05-16)


### Features

* **event:** add event import/export commands and clone step ([#114](https://www.github.com/amplience/dc-cli/issues/114)) ([85a8889](https://www.github.com/amplience/dc-cli/commit/85a8889d7425aaa334c254d5c8204fb37e571841))

## [0.14.0](https://www.github.com/amplience/dc-cli/compare/v0.13.0...v0.14.0) (2022-05-05)


### Features

* add regex lookup to type and schema export ([#126](https://www.github.com/amplience/dc-cli/issues/126)) ([93a0cdd](https://www.github.com/amplience/dc-cli/commit/93a0cddec309340ccf88e2abb16ae77de22435ec))
* use facet request to reduce content fetched when facets in use ([#128](https://www.github.com/amplience/dc-cli/issues/128)) ([34e5223](https://www.github.com/amplience/dc-cli/commit/34e52237f1e84ce11badb00abfce44876ee8977b))


### Bug Fixes

* allow empty import without error, fix search index export on accounts where it is disabled ([#125](https://www.github.com/amplience/dc-cli/issues/125)) ([cce328b](https://www.github.com/amplience/dc-cli/commit/cce328b964dc581ca2fdc8df399a3a3cd5bb7bbf))
* **search-index:** fix replica name rewriting ([#124](https://www.github.com/amplience/dc-cli/issues/124)) ([b692416](https://www.github.com/amplience/dc-cli/commit/b692416093140bb9845486fa4bc93e4e26ebd68a))

## [0.13.0](https://www.github.com/amplience/dc-cli/compare/v0.12.0...v0.13.0) (2022-01-06)


### ⚠ BREAKING CHANGES

* move dest configuration to the regular config file (#110)

### Features

* **content-item:** make --publish flag publish on update when source publish date is more recent ([#115](https://www.github.com/amplience/dc-cli/issues/115)) ([c0c2174](https://www.github.com/amplience/dc-cli/commit/c0c2174d818840380d76ba35e4ff65748db7ce26))
* facet argument for content item commands  ([#111](https://www.github.com/amplience/dc-cli/issues/111)) ([dd4ddab](https://www.github.com/amplience/dc-cli/commit/dd4ddabbee775b35614ebf7fbad7759aa2b7afc6))
* move dest configuration to the regular config file ([#110](https://www.github.com/amplience/dc-cli/issues/110)) ([1a1c180](https://www.github.com/amplience/dc-cli/commit/1a1c18090c907538ad6c3e6912df8b50547cffd8))
* readme overhaul ([#116](https://www.github.com/amplience/dc-cli/issues/116)) ([49687d6](https://www.github.com/amplience/dc-cli/commit/49687d68c43862e97f501ff1001a4a8ab6726991))
* **search-index:** add search-index export and import commands ([#105](https://www.github.com/amplience/dc-cli/issues/105)) ([ebfaf0b](https://www.github.com/amplience/dc-cli/commit/ebfaf0bc9a611b78f6ccbd553aadf6ae3044146c))

## [0.12.0](https://www.github.com/amplience/dc-cli/compare/v0.11.2...v0.12.0) (2021-09-14)


### Features

* **config:** allow using configure command with a custom file ([#80](https://www.github.com/amplience/dc-cli/issues/80)) ([5cc2939](https://www.github.com/amplience/dc-cli/commit/5cc2939ee78f173e045618c8fd51a9f3d06e8d57))
* **config:** print helpful error if config file is invalid json ([#108](https://www.github.com/amplience/dc-cli/issues/108)) ([ce51fbc](https://www.github.com/amplience/dc-cli/commit/ce51fbcffeb3cf9ffb0e53f8fbe02dee8506980c))
* **extension:** extension import and export commands, clone step ([#92](https://www.github.com/amplience/dc-cli/issues/92)) ([e322f5d](https://www.github.com/amplience/dc-cli/commit/e322f5d0ed5977c6e1967dda1dc796c674407611))
* **file-log:** add version to file-log title ([#107](https://www.github.com/amplience/dc-cli/issues/107)) ([c95de01](https://www.github.com/amplience/dc-cli/commit/c95de01fe922f2d364ff9fc5cf6ea8e96ce016d8))


### Bug Fixes

* **content-type-schema:** always treat archived schemas as out of date ([#112](https://www.github.com/amplience/dc-cli/issues/112)) ([49085dd](https://www.github.com/amplience/dc-cli/commit/49085ddd471b0a08726ccb175c540bdabaa81763))
* **settings:** add missing log file option to settings export command ([#103](https://www.github.com/amplience/dc-cli/issues/103)) ([602832c](https://www.github.com/amplience/dc-cli/commit/602832c2a131b6044163a3f8350b3ffe1667d0f5))
* unit test logging ([#100](https://www.github.com/amplience/dc-cli/issues/100)) ([3c5586f](https://www.github.com/amplience/dc-cli/commit/3c5586f04a5d66e012901a19ef6ca2cce5ba2c0a))

### [0.11.2](https://www.github.com/amplience/dc-cli/compare/v0.11.1...v0.11.2) (2021-07-21)


### Bug Fixes

* json-exporter can now handle both windows and unix paths, regardless of host os ([#98](https://www.github.com/amplience/dc-cli/issues/98)) ([de7e6d2](https://www.github.com/amplience/dc-cli/commit/de7e6d26a4c570f0c1f15da1d906d2e425089e33))

### [0.11.1](https://www.github.com/amplience/dc-cli/compare/v0.11.0...v0.11.1) (2021-07-20)


### Bug Fixes

* combine workflow state and content item mapping files ([#96](https://www.github.com/amplience/dc-cli/issues/96)) ([e9ceb96](https://www.github.com/amplience/dc-cli/commit/e9ceb962e7c1acec55b11489fc60bd7d548ecaff))

## [0.11.0](https://www.github.com/amplience/dc-cli/compare/v0.10.0...v0.11.0) (2021-06-17)


### Features

* **content-item:** add tree command, improved circular dependency import ([#91](https://www.github.com/amplience/dc-cli/issues/91)) ([39bdddf](https://www.github.com/amplience/dc-cli/commit/39bdddf540baeebcc44fb353d473a61218b2bd37))
* **content-item:** detect and rewrite media links when importing with --media flag ([#71](https://www.github.com/amplience/dc-cli/issues/71)) ([3fd9437](https://www.github.com/amplience/dc-cli/commit/3fd94371df77d4b32964d8c7fff5e05b8fdd4f75))
* **hub:** clean hub command ([#77](https://www.github.com/amplience/dc-cli/issues/77)) ([9fb7b80](https://www.github.com/amplience/dc-cli/commit/9fb7b807707379792f4ac278d833b4b4d03409da))
* **hub:** clone hub command ([#76](https://www.github.com/amplience/dc-cli/issues/76)) ([0d6c43c](https://www.github.com/amplience/dc-cli/commit/0d6c43c53b3ec6d0c6ca36f9b9061ce013f1da1e))


### Bug Fixes

* **export:** content type schemas and content types special characters ([#69](https://www.github.com/amplience/dc-cli/issues/69)) ([d73104c](https://www.github.com/amplience/dc-cli/commit/d73104c73c5ce5de25c243d5df31bac67efdef4e))
* strip locale before importing, then set it afterwards ([#70](https://www.github.com/amplience/dc-cli/issues/70)) ([10838fd](https://www.github.com/amplience/dc-cli/commit/10838fda47b793bae5af3b2fd3e1a72964ec9583))

## [0.10.0](https://www.github.com/amplience/dc-cli/compare/v0.9.0...v0.10.0) (2021-03-16)


### Features

* **log:** log errors in a more consistent fashion ([#72](https://www.github.com/amplience/dc-cli/issues/72)) ([db7067c](https://www.github.com/amplience/dc-cli/commit/db7067c88c2b89618e2c7ab5db2cc9ec8ba03d52))

## [0.9.0](https://github.com/amplience/dc-cli/compare/v0.8.1...v0.9.0) (2020-12-17)


### Features

* **event:** feature of archive and delete events along with their editions ([#64](https://github.com/amplience/dc-cli/issues/64)) ([3c2a9c5](https://github.com/amplience/dc-cli/commit/3c2a9c5))
* **settings:** export and import settings between hubs ([#63](https://github.com/amplience/dc-cli/issues/63)) ([b67d5d9](https://github.com/amplience/dc-cli/commit/b67d5d9))

### [0.8.1](https://github.com/amplience/dc-cli/compare/v0.8.0...v0.8.1) (2020-12-16)


### Bug Fixes

* **deps:** moved rimraf from dev dep to dep ([6ac1e5d](https://github.com/amplience/dc-cli/commit/6ac1e5d))

## [0.8.0](https://github.com/amplience/dc-cli/compare/v0.7.0...v0.8.0) (2020-12-16)


### Bug Fixes

* **content-item:** disregard hierarchical dependencies for publishing ([19f3d25](https://github.com/amplience/dc-cli/commit/19f3d25))
* **content-item:** ignore case for unique filename check ([e2b9ef2](https://github.com/amplience/dc-cli/commit/e2b9ef2))
* **content-type:** consider archived content types as reserved/updatable ([51662ae](https://github.com/amplience/dc-cli/commit/51662ae))
* **content-type-schema:** ensure content type and type schema names are unique ([f106598](https://github.com/amplience/dc-cli/commit/f106598))


### Features

* **content-item:** add copy and move commands ([#61](https://github.com/amplience/dc-cli/issues/61)) ([ae5e062](https://github.com/amplience/dc-cli/commit/ae5e062))
* **content-item:** add dependancy tracking for hierarchies ([babbbea](https://github.com/amplience/dc-cli/commit/babbbea))
* **content-type:** allow archived content types to be exported using a flag ([dbe5bb4](https://github.com/amplience/dc-cli/commit/dbe5bb4))
* **content-type-schema:** make exporting archived schema optional, automatically create destination ([2aa7a90](https://github.com/amplience/dc-cli/commit/2aa7a90))

## [0.7.0](https://github.com/amplience/dc-cli/compare/v0.6.0...v0.7.0) (2020-10-22)


### Features

* **content-item:** archive/unarchive content item commands ([#60](https://github.com/amplience/dc-cli/issues/60)) ([b3f0de6](https://github.com/amplience/dc-cli/commit/b3f0de6))

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
