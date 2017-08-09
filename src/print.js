const chalk = require('chalk');

/**
 * Helper ("private") function for making indentations.
 * @param {Integer} count
 */
function indent(count) {}

/**
 * A helper class for printing cleaner and more uniform output messages
 */
class Print {
    /**
     * Bold red
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    static error(msg, indentationCount = 0) {
        console.log(chalk.bold.red(`${'\t'.repeat(indentationCount)}==> ${msg}`));
    }

    /**
     * Amber
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    static warning(msg, indentationCount = 0) {
        console.log(chalk.yellow(`${'\t'.repeat(indentationCount)}==> ${msg}`));
    }

    /**
     * Green
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    static success(msg, indentationCount = 0) {
        console.log(chalk.green(`${'\t'.repeat(indentationCount)}==> ${msg}`));
    }

    /**
     * No formatting. White.
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    static info(msg, indentationCount = 0) {
        console.log(`${'\t'.repeat(indentationCount)}==> ${msg}`);
    }

    /**
     * Bold
     * @param {String} msg
     * @param {Integer} indentationCount number of \t before print
     */
    static bold(msg, indentationCount = 0) {
        console.log(chalk.bold(`${'\t'.repeat(indentationCount)}==> ${msg}`));
    }
}

module.exports = Print;
