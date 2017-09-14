'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'init';
    cmd.desc =
        'initializes a new Baker environment by creating a baker.yml file';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker, print } = dep;

        try {
            await baker.init();
            print.info('Created baker.yml in current directory')
        } catch (err){
            print.error(err);
        }
    };

    return cmd;
};
