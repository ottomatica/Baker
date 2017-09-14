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
        }
    };
    cmd.handler = async function(argv) {
        const { local, repo } = argv;
        const { path, baker, cloneRepo, validator, print } = dep;

        try{
            let ansibleVM;
            let bakePath;

            if (local) {
                bakePath = path.resolve(local);
            } else if (repo) {
                bakePath = path.resolve(await cloneRepo.cloneRepo(repo));
            } else {
                print.error(
                    `User --local to give local path or --repo to give git repository with baker.yml`
                );
                process.exit(1);
            }

            validator.validateBakerScript(bakePath);
            ansibleVM = await baker.prepareAnsibleServer(bakePath);
            let sshConfig = await baker.getSSHConfig(ansibleVM);
            await baker.bake(sshConfig, ansibleVM, bakePath);

            print.info('Baking VM finished.');
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};
