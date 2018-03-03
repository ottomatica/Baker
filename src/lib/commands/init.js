const Baker = require('../modules/baker');

exports.command = 'init';
exports.desc = 'initializes a new Baker environment by creating a baker.yml file';
exports.handler = async function(argv) {
    await Baker.initBaker2();
}
