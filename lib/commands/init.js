const Interactive = require('../modules/init/interactive');

exports.command = 'init';
exports.desc = 'initializes a new Baker environment by creating a baker.yml file';
exports.handler = async function(argv) {
    await Interactive.initBaker2();
}
