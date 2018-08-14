const Baker          = require('../modules/baker');
const Git            = require('../modules/utils/git');
const path           = require('path');
const Print          = require('../modules/print');
const Servers        = require('../modules/servers');

const  { bakerSSHConfig } = require('../../global-vars');

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
            },
            forceVirtualBox: {
                describe: `Force using virtualbox instead of xhyve VM on Mac (no effect on Windows/Linux)`,
                hidden: true, // just for debugging for now
                demand: false,
                type: 'boolean'
            },
            useContainer: {
                describe: `Override environment type to use container`,
                demand: false,
                type: 'boolean'
            },
            useVM: {
                describe: `Override environment type to use vm`,
                demand: false,
                type: 'boolean'
            }
        }
    );
};

exports.handler = async function(argv) {
    const { local, repo, box, remote, remote_key, remote_user, verbose, forceVirtualBox, useContainer, useVM  } = argv;

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

        const {provider, BakerObj} = await Baker.chooseProvider(bakePath, useContainer, useVM);

        if(box)
            await provider.bakeBox(bakerSSHConfig, ansibleVM, bakePath, verbose);
        else if(remote)
            await BakerObj.bakeRemote(bakerSSHConfig, remote, remote_key, remote_user, bakePath, verbose);
        else{
            await Servers.installBakerServer(forceVirtualBox);

            await BakerObj.bake(bakePath, bakerSSHConfig, verbose);

            // Handle exposure of ports on server if container
            await BakerObj.exposePorts(path.join(bakePath, 'baker.yml'), verbose);

        }

    } catch (err) {
        Print.error(err);
    }
}
