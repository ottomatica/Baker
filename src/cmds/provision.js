exports.command = 'provision'
exports.desc = 'Provision a vm based on baker.yml'

exports.builder = {
  u: {
    alias: 'url',
    desc: 'Repo url of your ansible script',
    type: 'string',
    demandOption: 'Must provide url'
  }
}

exports.handler = function (argv) {
    console.log('Provisioning vm...', argv.url)
}