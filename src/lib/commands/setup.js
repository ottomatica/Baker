'use strict'

module.exports = function (dep) {
  let cmd = {}

  cmd.command = 'setup'
  cmd.desc = 'create a Baker server which will be used for provisioning yor VMs'
  cmd.builder = {
      force:{
          alias: 'f',
          describe: `if Baker server exists, first destroy it and then create a new one. Don't use this unless you know what you want to do.`,
          demand: false,
          type: 'boolean'
      }
  }
  cmd.handler = async function (argv) {
    const { force } = argv
    const { baker, print, spinner, spinnerDot } = dep

    try {
        if(force)
            await spinner.spinPromise(baker.reinstallAnsibleServer(), 'Re-installing Baker control machine', spinnerDot);
        else
            await spinner.spinPromise(baker.installAnsibleServer(), 'Installing Baker control machine', spinnerDot);
    } catch (err) {
        print.error(err);
    }

  }

  return cmd
}
