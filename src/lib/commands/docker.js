const Baker           = require('../modules/baker');
const Docker_Provider = require('../modules/providers/docker');
const fs              = require('fs-extra');
const Git             = require('../modules/utils/git');
const path            = require('path');
const Print           = require('../modules/print');
const Spinner         = require('../modules/spinner');

const { spinnerDot } = require('../../global-vars');

exports.command = 'docker [command]';
exports.desc    = 'Spin up docker containers';

exports.builder = (yargs) => {
    yargs
        .example(`$0 docker start --local .`, `Start a docker container based on baker.yml of current directory`);

    yargs.positional('command', {
        describe: 'bake | start | stop | destroy | list | ssh',
        type: 'string',
        default: 'bake'
    })

    yargs.options({
        local: {
            alias: 'l',
            describe: `give a local path to where your baker.yml file is located`,
            demand: false,
            type: 'string'
        }
    });
};

exports.handler = async function(argv) {
    const { local, repo, verbose } = argv;

    // Check if command is valid
    if(!['bake', 'start', 'stop', 'destroy', 'list', 'ssh'].includes(argv.command)) {
        Print.error(`invalid command: ${argv.command}`);
        process.exit(1);
    }


    let bakePath = local || process.cwd();
    let ansibleVM;
    try {
        ansibleVM = await Spinner.spinPromise(Baker.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
    }
    catch(ex) {
        await Spinner.spinPromise(Baker.upVM('baker'), `Restarting Baker control machine`, spinnerDot);
        ansibleVM = await Spinner.spinPromise(Baker.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
    }

    let sshConfig = await Baker.getSSHConfig(ansibleVM);

    switch (argv.command) {
        case 'bake':
            await Baker.bakeDocker(local || process.cwd(), sshConfig);
            break;

        case 'start':
            await Baker.startDocker(local || process.cwd(), sshConfig);
            break;

        case 'stop':
            await Spinner.spinPromise(Baker.stopDocker(local || process.cwd()), `Stopping Docker container`, spinnerDot);
            break;

        case 'destroy':
            await Spinner.spinPromise(Baker.removeDocker(local || process.cwd()), `Removing Docker container`, spinnerDot);
            break;

        case 'list':
            await Spinner.spinPromise(Baker.prepareDockerVM(), `Preparing Docker host`, spinnerDot);
            console.log(await Baker.listDocker());
            break;

        case 'ssh':
            await Baker.SSHDocker(local || process.cwd());

        default:
            break;
    }
}
