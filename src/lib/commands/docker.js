const Baker     = require('../modules/baker');
const Git       = require('../modules/utils/git');
const fs = require('fs-extra');
const path      = require('path');
const Print     = require('../modules/print');
const Spinner   = require('../modules/spinner');

const { spinnerDot } = require('../../global-vars');

exports.command = 'docker';
exports.desc    = 'Spin up docker containers';

exports.builder = (yargs) => {
    // TODO:
    // yargs
    //     .example(`$0 cluster --local`, `This is an example of how to use this command`);

    yargs.options({
        local: {
            alias: 'l',
            describe: `give a local path to where your baker.yml file is located`,
            demand: false,
            type: 'string'
        },
        repo: {
            alias: 'r',
            describe: `give a git repository URL which has a baker.yml in it's root directory`,
            demand: false,
            type: 'string'
        },
        verbose: {
            alias: 'v',
            describe: `Provide extra output from baking process`,
            demand: false,
            type: 'boolean'
        }
    });
};

exports.handler = async function(argv) {
    const { local, repo, verbose } = argv;

    await Baker.bakeDocker(local || process.cwd());

}
