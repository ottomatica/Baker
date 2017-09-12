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

        let ansibleVM;

        if (local) {
            // console.log(path.resolve(local))
            validator.validateBakerScript(path.resolve(local));
            ansibleVM = await baker.prepareAnsibleServer(path.resolve(local));
            let sshConfig = await baker.getSSHConfig(ansibleVM);
            baker.bake(sshConfig, ansibleVM, path.resolve(local));
        } else if (repo) {
            let localRepoPath = await cloneRepo.cloneRepo(repo);
            validator.validateBakerScript(path.resolve(localRepoPath));
            ansibleVM = await baker.prepareAnsibleServer(localRepoPath);
            let sshConfig = await baker.getSSHConfig(ansibleVM);
            baker.bake(sshConfig, ansibleVM, localRepoPath);
        } else {
            print.error(
                `User --local to give local path or --repo to give git repository with baker.yml`
            );
            process.exit(1);
        }
    };

    return cmd;
};
