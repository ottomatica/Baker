'use strict';

/**
 * printing cleaner and more uniform output messages
 */
module.exports = function(dep) {
    let result = {};

    /**
     * Bold red
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    result.error = function(msg, indentationCount = 0) {
        const { chalk } = dep;

        console.log(
            chalk.bold.red(`${'\t'.repeat(indentationCount)}==> ${msg}`)
        );
    };

    /**
     * Amber
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    result.warning = function(msg, indentationCount = 0) {
        const { chalk } = dep;

        console.log(chalk.yellow(`${'\t'.repeat(indentationCount)}==> ${msg}`));
    };

    /**
     * Green
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    result.success = function(msg, indentationCount = 0) {
        const { chalk } = dep;

        console.log(chalk.green(`${'\t'.repeat(indentationCount)}==> ${msg}`));
    };

    /**
     * No formatting. White.
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    result.info = function(msg, indentationCount = 0) {
        const { chalk } = dep;

        console.log(`${'\t'.repeat(indentationCount)}==> ${msg}`);
    };

    /**
     * Bold
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    result.bold = function(msg, indentationCount = 0) {
        const { chalk } = dep;

        console.log(chalk.bold(`${'\t'.repeat(indentationCount)}==> ${msg}`));
    };

    return result;
};
