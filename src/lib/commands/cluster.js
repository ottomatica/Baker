const Baker     = require('../modules/baker');
const conf      = require('../../lib/modules/configstore');
const Git       = require('../modules/utils/git');
const path      = require('path');
const Print     = require('../modules/print');
const Spinner   = require('../modules/spinner');
const Servers   = require('../modules/servers');

const spinnerDot = conf.get('spinnerDot');

exports.command = 'cluster';
exports.desc    = 'Bake your Cluster given local path or repository URL containing the baker.yml';

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

    try{
        let ansibleVM;
        let bakePath;

        if (local) {
            bakePath = path.resolve(local);
        } else if (repo) {
            bakePath = path.resolve(await Git.clone(repo));
        } else {
            Print.error(
                `User --local to give local path or --repo to give git repository with baker.yml`
            );
            process.exit(1);
        }

        try
        {
            ansibleVM = await Spinner.spinPromise(Servers.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
        }
        catch(ex)
        {
            await Spinner.spinPromise(Baker.upVM('baker'), `Restarting Baker control machine`, spinnerDot);
            ansibleVM = await Spinner.spinPromise(Servers.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
        }

        let sshConfig = await Baker.getSSHConfig(ansibleVM);

        await Baker.cluster(sshConfig, ansibleVM, bakePath, verbose);

    } catch (err) {
        Print.error(err);
    }
}
