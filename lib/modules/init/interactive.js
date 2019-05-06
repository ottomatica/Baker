const Promise       = require('bluebird');
const conf          = require('../configstore');
const fs            = require('fs-extra');
const inquirer      = require('inquirer');
const mustache      = require('mustache');
const path          = require('path');
const spinner       = require('../spinner');
const Utils         = require('../utils/utils');
const validator     = require('validator');

// conf variables:
const spinnerDot = conf.get('spinnerDot');

const { configPath} = require('../../../global-vars');

class Interactive {

    static async initBaker2() {
        let self = this;
        // TODO: Find a better approach to do this
        try{
            if (await fs.pathExists(await path.resolve(path.resolve(process.cwd(), 'baker.yml'))))
                await spinner.spinPromise(Promise.reject(), `A baker.yml already exists in current directory!`, spinnerDot);
        } catch (err) { return; }

        let vmResponse = await inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Baker environment name:',
                    default: path.basename(process.cwd())
                },
                {
                    type: 'list',
                    name: 'memory',
                    message: 'Amount of memory to share with this environment (in MB):',
                    choices: ['512', '1024', '2048', '3072', '4096'],
                    default: '1024'
                },
                {
                    type: 'input',
                    name: 'ip',
                    message: 'IP to use for this VM: ',
                    validate: async function(ip) {
                        let pass = validator.isIP(ip);

                        var exists = await Utils.hostIsAccessible(ip);

                        if (pass && !exists) {
                            return true;
                        } else if (exists) {
                            return 'Another VM is using this IP, please enter a different IP address';
                        } else {
                            return 'This IP is not available, please enter a valid IP address';
                        }
                    }
                },
                {
                    type: 'input',
                    name: 'ports',
                    message: 'Forward ports comma separated, (GUEST:HOST) or (GUEST):',
                    validate: async function(value) {
                        if(value === '')
                            return true;

                        let ports = value.split(',').map(port => port.split(':'));
                        let invalidPorts = [];

                        ports.forEach(pp => {
                            pp.forEach(p => {
                                if(!validator.isPort(p.trim()))
                                    invalidPorts.push(p);
                            });
                        });

                        if (invalidPorts.length != 0) {
                            return `These ports are invalid, please enter valid ports: ${invalidPorts.join(' ')}`;
                        } else {
                            return true;
                        }
                    }
                },
                {
                    type: 'checkbox',
                    message: 'Select languages:',
                    name: 'langs',
                    choices: [
                        {
                            name: 'java8'
                        },
                        {
                            name: 'nodejs9'
                        },
                        {
                            name: 'R'
                        },
                        {
                            name: 'python2'
                        },
                        {
                            name: 'python3'
                        },
                    ]
                },
                {
                    type: 'checkbox',
                    message: 'Select services:',
                    name: 'services',
                    choices: [
                        {
                            name: 'docker'
                        },
                        {
                            name: 'neo4j'
                        }
                    ]
                },
                {
                    type: 'checkbox',
                    message: 'Select tools:',
                    name: 'tools',
                    choices: [
                        {
                            name: 'ansible'
                        },
                        {
                            name: 'jupyter'
                        },
                        {
                            name: 'maven'
                        },
                        {
                            name: 'jekyll'
                        },
                        {
                            name: 'latex'
                        },
                        {
                            name: 'defects4j'
                        }
                    ]
                }
            ]);

        // TODO: refactor
        vmResponse.langs = vmResponse.langs.length ? {lang: vmResponse.langs} : false;
        vmResponse.services = vmResponse.services.length ? {service: vmResponse.services} : false;
        vmResponse.tools = vmResponse.tools.length ? {tool: vmResponse.tools} : false;

        let baker2Template = await fs.readFile(path.join(configPath, './baker2Template.yml.mustache'), 'utf8');
        let bakerYML = mustache.render(baker2Template, vmResponse);
        let cwd = path.resolve(process.cwd());
        await fs.writeFile(path.resolve(cwd, 'baker.yml'), bakerYML, { encoding: 'utf8' });
        return;
    }

    /**
     * Get list of available bakelets
     * @param {String} type  services, lang, tools
     */
    static _listBakelets(type) {
        return fs.readdirSync(path.resolve(`./lib/bakelets/${type}`)).map(e => {return { 'name': e.replace('.js', '')}});
    }
}

module.exports = Interactive;
