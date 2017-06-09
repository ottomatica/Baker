#!/usr/bin/env node
const _ = require("underscore");

var yargs = require("yargs");

var argv = yargs
    // version
    .alias("v", "version")
    .version(() => {
        return require("./package.json").version;
    })
    .describe("v", "show version information")
    // command directory
    .showHelpOnFail(false, "Invalide command. Try `$ baker --help` for available options.")
    .commandDir("cmds")
    .demandCommand(1)
    .help("h")
    .alias("h", "help").argv;

const validCommands = ["install", "provision"];
var command = ''

if (_.intersection(argv._, validCommands) != []) yargs.showHelp();
// else command = argv._[0]

