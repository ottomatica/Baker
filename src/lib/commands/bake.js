const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore');
const Git            = require('../modules/utils/git');
const path           = require('path');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const VagrantProvider = require('../modules/providers/vagrant');

const spinnerDot = conf.get('spinnerDot');

// exports.aliases = ['$0'];
exports.command = 'bake'
exports.desc = 'Bake your VM given local path or repository URL containing the baker.yml';
exports.builder = (yargs) => {
    yargs
        .example(`$0 bake`, `Bake baker.yml of current directory`)
        .example(`$0 bake --local ~/project`, `Bake baker.yml of ~/project`)
        .example(`$0 bake --repo git@github.com:ottomatica/baker-test.git`, `Clone repository in current directory and Bake its baker.yml`);

    yargs.options(
        {
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
            box: {
                alias: 'b',
                describe: `give local path to where your baker.yml file is located`,
                demand: false,
                type: 'string'
            },
            remote: {
                describe: `give ip address of the remote server`,
                demand: false,
                type: 'string'
            },
            remote_key: {
                describe: `give path to the ssh key of the remote server`,
                demand: false,
                type: 'string'
            },
            remote_user: {
                describe: `give the ssh username of the remote server`,
                demand: false,
                type: 'string'
            },
            verbose: {
                alias: 'v',
                describe: `Provide extra output from baking process`,
                demand: false,
                type: 'boolean'
            }
        }
    );
};

exports.handler = async function(argv) {
    const { local, repo, box, remote, remote_key, remote_user, verbose } = argv;

    //TODO: if vagrant:
    const provider = new VagrantProvider();
    const BakerObj = new Baker(provider);

    try{
        let ansibleVM;
        let bakePath;

        if( box ){
            bakePath = path.resolve(box);
        }
        else if (local) {
            bakePath = path.resolve(local);
        } else if (repo) {
            bakePath = path.resolve(await Git.clone(repo));
        } else if (remote) {
            bakePath = path.resolve(process.cwd());
        } else {
            let cwdVM = await Baker.getCWDBakerYML();
            if(cwdVM){
                bakePath = cwdVM.cwd;
            } else {
                Print.error(
                    `Can't find baker.yml in cwd. Use --local to give local path or --repo to give git repository with baker.yml`
                );
                process.exit(1);
            }
        }

        //let validation = await Spinner.spinPromise(Validator.validateBakerScript(bakePath), 'Validating baker.yml', spinnerDot);

        try
        {
            ansibleVM = await Spinner.spinPromise(Baker.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
        }
        catch(ex)
        {
            await Spinner.spinPromise(BakerObj.start('baker'), `Restarting Baker control machine`, spinnerDot);
            ansibleVM = await Spinner.spinPromise(Baker.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
        }

        let sshConfig = await Baker.getSSHConfig(ansibleVM);

        if(box)
            await provider.bakeBox(sshConfig, ansibleVM, bakePath, verbose);
        else if(remote)
            await Baker.bakeRemote(sshConfig, remote, remote_key, remote_user, bakePath, verbose);
        else
            await BakerObj.bake(bakePath, sshConfig, ansibleVM, verbose);

    } catch (err) {
        Print.error(err);
    }
}
