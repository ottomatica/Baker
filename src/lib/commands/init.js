'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'init';
    cmd.desc =
        'initializes a new Baker environment by creating a baker.yml file';
    cmd.builder = {};
    cmd.handler = function(argv) {
        const { baker } = dep;
        baker.init();
    };

    return cmd;
};
