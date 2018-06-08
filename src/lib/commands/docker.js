const Baker           = require('../modules/baker');
const conf            = require('../../lib/modules/configstore');
const Print           = require('../modules/print');
const Spinner         = require('../modules/spinner');

const spinnerDot = conf.get('spinnerDot');

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

    switch (argv.command) {
        case 'bake':
            await Baker.bakeDocker(bakePath);
            break;

        case 'start':
            await Baker.startDocker(bakePath);
            break;

        case 'stop':
            await Spinner.spinPromise(Baker.stopDocker(bakePath), `Stopping Docker container`, spinnerDot);
            break;

        case 'destroy':
            await Spinner.spinPromise(Baker.removeDocker(bakePath), `Removing Docker container`, spinnerDot);
            break;

        case 'list':
            console.log(await Baker.listDocker());
            break;

        case 'ssh':
            await Baker.SSHDocker(bakePath);

        default:
            break;
    }
}
