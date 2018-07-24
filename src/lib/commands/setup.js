const conf      = require('../../lib/modules/configstore');
const path      = require('path');
const Print     = require('../modules/print');
const Spinner   = require('../modules/spinner');
const Validator = require('../modules/validator');
const Servers   = require('../modules/servers');
const Utils     = require('../modules/utils/utils');

const spinnerDot = conf.get('spinnerDot');
const { configPath, ansible } = require('../../global-vars');

exports.command = 'setup'
exports.desc = 'create a Baker server which will be used for provisioning yor VMs'

exports.builder = (yargs) => {
    yargs.options({
        force:{
            alias: 'f',
            describe: `if Baker server exists, first destroy it and then create a new one. Don't use this unless you know what you want to do.`,
            demand: false,
            type: 'boolean'
        }
    });
}

exports.handler = async function (argv) {
    const { force } = argv

    try {
        await Spinner.spinPromise(Validator.validateDependencies(), 'Checking dependencies', spinnerDot);
    } catch (err){
        Print.error(err);
        process.exit(1);
    }

    try {
        if(force)
            await Spinner.spinPromise(Servers.reinstallAnsibleServer(), 'Re-installing Baker control machine', spinnerDot);
        else
            await Spinner.spinPromise(Servers.installAnsibleServer(), 'Installing Baker control machine', spinnerDot);

        await Spinner.spinPromise(
            Utils.copyFileSync(
                path.resolve(configPath, './baker_rsa.pub'),
                path.resolve(ansible, 'keys'),
                'baker_rsa.pub'
            ),
            'Copying private ssh key',
            spinnerDot
        );

        await Spinner.spinPromise(
            Utils.copyFileSync(
                path.resolve(configPath, './baker_rsa'),
                path.resolve(ansible, 'keys'),
                'baker_rsa'
            ),
            'Copying public ssh key',
            spinnerDot
        );

    } catch (err) {
        Print.error(err);
    }
  }
