'use strict';

module.exports = function(dep) {
    let result = {};

    result.spinPromise = async function spin(promise, text, spinner, stream=process.stdout){
        const { ora } = dep;

        ora.promise(promise, {
            text: text,
            spinner: spinner,
            stream: stream
            // color: false,
            // enabled: true
        });
        return promise;
    }

    return result;
};
