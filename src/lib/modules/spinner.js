'use strict';

module.exports = function(dep) {
    let result = {};

    result.spinPromise = async function spin(promise, text, spinner){
        const { ora } = dep;

        ora.promise(promise, {
            text: text,
            spinner: spinner
            // color: false,
            // enabled: true
        });
        return promise;
    }

    return result;
};
