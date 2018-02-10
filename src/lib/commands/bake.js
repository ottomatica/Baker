'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'bake';
    cmd.desc =
        'Bake your VM given local path or repository URL containing the baker.yml';
    cmd.builder = {
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
    };
    cmd.handler = async function(argv) {
        const { local, repo, box, remote, remote_key, remote_user, verbose } = argv;
        const { path, baker, cloneRepo, validator, print, spinner, spinnerDot } = dep;

            try{
                let ansibleVM;
                let bakePath;

                if( box ){
                    bakePath = path.resolve(box);
                }
                else if (local) {
                    bakePath = path.resolve(local);
                } else if (repo) {
                    bakePath = path.resolve(await cloneRepo.cloneRepo(repo));
                } else if (remote) {
                    bakePath = path.resolve(process.cwd());
                } else {
                    print.error(
                        `User --local to give local path or --repo to give git repository with baker.yml`
                    );
                    process.exit(1);
                }

                //let validation = await spinner.spinPromise(validator.validateBakerScript(bakePath), 'Validating baker.yml', spinnerDot);

                try
                {
                    ansibleVM = await spinner.spinPromise(baker.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
                }
                catch(ex)
                {
                    await spinner.spinPromise(baker.upVM('baker'), `Restarting Baker control machine`, spinnerDot);
                    ansibleVM = await spinner.spinPromise(baker.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
                }

                let sshConfig = await baker.getSSHConfig(ansibleVM);

                if(box)
                    await baker.bakeBox(sshConfig, ansibleVM, bakePath, verbose);
                else if(remote)
                    await baker.bakeRemote(sshConfig, remote, remote_key, remote_user, bakePath, verbose);
                else
                    await baker.bake2(sshConfig, ansibleVM, bakePath, verbose);

            } catch (err) {
                print.error(err);
            }
    };

    return cmd;
};
