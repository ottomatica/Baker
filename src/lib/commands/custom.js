const Baker     = require('../modules/baker');
const Git       = require('../modules/cloneRepo');
const path      = require('path');
const Print     = require('../modules/print');
const Spinner   = require('../modules/spinner');
const Validator = require('../modules/validator');

const { spinnerDot } = require('../../global-vars');

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'custom';
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

            let validation = await Spinner.spinPromise(Validator.validateBakerScript(bakePath), 'Validating baker.yml', spinnerDot);

            try
            {
                ansibleVM = await Spinner.spinPromise(Baker.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
            }
            catch(ex)
            {
                await Spinner.spinPromise(Baker.upVM('baker'), `Restarting Baker control machine: `, spinnerDot);
                ansibleVM = await Spinner.spinPromise(Baker.prepareAnsibleServer(bakePath), 'Preparing Baker control machine', spinnerDot);
            }

            let sshConfig = await Baker.getSSHConfig(ansibleVM);

            let baking = Baker.bake(sshConfig, ansibleVM, bakePath);
            await Spinner.spinPromise(baking, 'Baking VM', spinnerDot);

            // Print.info('Baking VM finished.');
        } catch (err) {
            Print.error(err);
        }
    };

    return cmd;
};
