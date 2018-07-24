const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore');
const DockerProvider = require('../modules/providers/docker');
const fs             = require('fs-extra');
const path           = require('path');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');
const yaml           = require('js-yaml');

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

    const dockerProvider = new DockerProvider({host: '192.168.252.251', port: '2375', protocol: 'http'});
    const BakerObj = new Baker(dockerProvider);

    // Check if command is valid
    if(!['bake', 'start', 'stop', 'destroy', 'list', 'ssh', 'images'].includes(argv.command)) {
        Print.error(`invalid command: ${argv.command}`);
        process.exit(1);
    }

    let bakePath = local || process.cwd();
    let doc = yaml.safeLoad(await fs.readFile(path.join(bakePath, 'baker.yml'), 'utf8'));
    let name = doc.name;

    await Servers.installBakerServer();

    switch (argv.command) {
        case 'bake':
            await BakerObj.bake(bakePath);
            break;

        case 'start':
            console.log('TODO: just starting a VM only gives you a blank container without running any bakelets')
            await BakerObj.start(bakePath);
            break;

        case 'stop':
            await Spinner.spinPromise(BakerObj.stop(name), `Stopping Docker container`, spinnerDot);
            break;

        case 'destroy':
            await Spinner.spinPromise(BakerObj.delete(name), `Removing Docker container`, spinnerDot);
            break;

        case 'list':
            await BakerObj.list();
            break;

        case 'ssh':
            await BakerObj.ssh(name);

        case 'images':
            await BakerObj.images();

        default:
            break;
    }
}
