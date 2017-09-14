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
    const { baker, print } = dep

    try {
        if(force)
            await baker.reinstallAnsibleServer();
        else
            await baker.installAnsibleServer();
        print.info('Baker control machine installed successfully.')
    } catch (err) {
        print.error(err);
    }

  }

  return cmd
}
