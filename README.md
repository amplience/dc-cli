# dc-cli

Command line interface for Amplience Dynamic Content service.

## Description
**dc-cli** is a command line interface application for Amplience Dynamic Content management APIs.

Run `dc-cli` to get a list of available commands

## Configuration
**dc-cli** requires a valid set of Amplience client credentials (`--client-key` & `--client-secret`) and hub ID (`--hub-id`) to operate. 
These parameters must be set using the command `dc-cli configure --client-key <KEY> --client-secret <SECRET> --hub-id <ID>` before using the CLI.

Once the tool has been configured the individual parameters can be overwrote by supplying them when running any of the commands, 
e.g `dc-cli <command> <action> --hub-id <ID>`.

By default the configuration is saved to a file in the directory `<HOME_DIR>/.amplience/`, this can be overridden using the `--config` option.

See `dc-cli configure --help` for more information.

## Installation
Installing the DC CLI from the NPM package manager can be achieved using the following command:
```bash
npm install -g @amplience/dc-cli
```

Or you can download the executable for your operating system from our download page [https://amplience.com/dc-cli/downloads](https://amplience.com/dc-cli/downloads)

## Building the CLI
We have included some NPM scripts to help create various installations of the CLI and in this section we will include instructions of how to:
* [Compile TypeScript to JavaScript](#compiling-typescript)
* [Package the CLI into executables](#building-executables)
* [Link the CLI with NPM for local development](#npm-link)

<a name="compiling-typescript"></a>
### Compiling TypeScript to Javascript
We are using the TypeScript command `tsc` to compile the code to JavaScript and the output of which is put into the `dist` directory.
A NPM script has been created to run this compile step and can be utilised if you want to just use the raw JavaScript.

The command to achieve this is:
```bash
npm run build
```
<a name="building-executables"></a>
### Building Executables

**Prerequisites**:
* [ronn](http://rtomayko.github.io/ronn/ronn.1.html) is required to convert the markdown HOW_TO_USE.md to the manpage 

To support the use of the CLI as a standalone application within Windows, Linux and Mac OS we have added a step to export the code as an executable.
This step can be achieved by running the command:
```bash
npm run build:package
```
The output of this command will be three executables within the packages directory, one for Linux, Mac OS and Windows:
* dc-cli-linux 
* dc-cli-macos 
* dc-cli-win.exe

Creating a versioned zipped set of executables is also achievable using the following command:
```bash
npm run build:compress
``` 
Where the output of this command will also be created in the packages directory, they will now be zip files for each OS with a version:
* dc-cli-linux-1.0.0-0.zip
* dc-cli-macos-1.0.0-0.zip
* dc-cli-win-1.0.0-0.zip

<a name="npm-link"></a>
### Linking with NPM for local development
To run the CLI locally via the command prompt for local development the application must first be [compiled](#compiling-typescript).
Once compiled the CLI can then be linked with NPM to act like it has been installed, to achieve this we can run the script:
```bash
npm link
```
This will then allow the CLI to be used as if it was an executable like so:
```bash
dc-cli COMMAND --param1 foo -- param2 bar
```
