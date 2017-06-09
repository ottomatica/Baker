exports.command = 'install'
// exports.reuired = true
exports.desc = 'Install dependencies.'

exports.builder = {
  p: {
    alias: 'pull',
    desc: 'Pull ansible worker box to get started faster.',
    type: 'boolean',
  }
}
exports.handler = function (argv) {
  console.log('Installing dependencies...', argv.dir)
}
