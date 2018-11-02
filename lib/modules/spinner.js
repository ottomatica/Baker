const ora = require('ora');

class Spinner {
    constructor() {}

    static async spinPromise(promise, text, spinner, stream = process.stdout) {
        ora.promise(promise, {
            text: text,
            spinner: spinner,
            stream: stream
            // color: false,
            // enabled: true
        });
        return promise;
    }
}

module.exports = Spinner;
