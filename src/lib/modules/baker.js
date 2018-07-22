const Promise       = require('bluebird');
const conf          = require('./configstore');
const fs            = require('fs-extra');
const inquirer      = require('inquirer');
const mustache      = require('mustache');
const netaddr       = require('netaddr');
const path          = require('path');
const print         = require('./print');
const Provider      = require('../modules/providers/provider');
const spinner       = require('./Spinner');
const Ssh           = require('./ssh');
const Utils         = require('./utils/utils');
const vagrant       = Promise.promisifyAll(require('node-vagrant'));
const validator     = require('validator');
const yaml          = require('js-yaml');

const VagrantProvider = require('./providers/vagrant');
const VirtualBoxProvider = require('./providers/virtualbox');
const DockerProvider  = require('./providers/docker');
const DO_Provider     = require('./providers/digitalocean');
const RemoteProvider  = require('./providers/remote');

// conf variables:
const spinnerDot = conf.get('spinnerDot');

const { configPath, ansible, boxes, bakeletsPath, remotesPath } = require('../../global-vars');

class Baker {
    /**
     *
     * @param {Provider} provider
     */
    constructor(provider) {
        this.provider = provider;
    }

    async ssh(name) {
        await this.provider.ssh(name);
    }

    async start(name, verbose) {
        await this.provider.start(name, verbose);
    }

    async stop(name, force) {
        await this.provider.stop(name, force);
    }

    async delete(name) {
        await this.provider.delete(name);
    }

    async bake(scriptPath, ansibleSSHConfig, verbose) {
        await this.provider.bake(scriptPath, ansibleSSHConfig, verbose);
    }

    async list() {
        await this.provider.list();
    }

    async images(){
        await this.provider.images();
    }

    static async init() {
        let bakerYML = await fs.readFile(path.join(configPath, './bakerTemplate.yml'), 'utf8');
        let dir = path.resolve(process.cwd());
        await fs.writeFile('baker.yml', bakerYML, {encoding:'utf8'});
    }

    /**
     * detects the type of environment.
     * Helper function for commands to automatically create the right provider object.
     * @param {String} bakePath path to the baker.yml file
     */
    static async chooseProvider(bakePath){
        let doc = yaml.safeLoad(await fs.readFile(path.join(bakePath, 'baker.yml'), 'utf8'));
        let envName = doc.name;
        let envType = doc.container ? 'container' : doc.vm || doc.vagrant ? 'vm' : doc.remote ? 'remote' : 'other';

        let provider = null;
        if(envType === 'container')
            provider = new DockerProvider({host: '192.168.252.251', port: '2375', protocol: 'http'});
        else if(envType === 'vm')
            //provider = new VagrantProvider();
            provider = new VirtualBoxProvider();
        else if(envType === 'remote'){
            if(!RemoteProvider.validateBakerYML(bakePath)){
                console.error('invalid baker.yml for remote provider');
                process.exit(1);
            }
            else
                provider = new RemoteProvider(doc.remote.user, doc.remote.private_key, doc.remote.ip, doc.remote.port);
        }
        else
            console.error('This command only supports VM and container environments');

        let BakerObj = new Baker(provider);

        return {envName, provider, BakerObj};
    }

    static async getCWDBakerYML(){
        let cwd = path.resolve(process.cwd());
        let bakePath = path.resolve(cwd, 'baker.yml')
        if(await fs.pathExists(bakePath)){
            let bakerYML = yaml.safeLoad(await fs.readFile(bakePath, 'utf8'));
            bakerYML.cwd = cwd;
            return bakerYML;
        } else{
            return undefined;
        }
    }

    /**
     * Get ssh configurations
     * @param {Obj} machine
     * @param {Obj} nodeName Optionally give name of machine when multiple machines declared in single Vagrantfile.
     */
    static async getSSHConfig (machine, nodeName) {
        this.provider.getSSHConfig(machine, nodeName);
    }

    static async info (envName, provider, verbose) {

        if( provider === 'digitalocean')
        {
            //console.log(envName, provider, verbose);
            let token = process.env.DOTOKEN;
            let dir = path.join(require('os').homedir(), '.baker', envName);

            let do_provider = new DO_Provider(token, dir);
            let nodes = await do_provider.info();
            console.log( JSON.stringify(nodes) );
        }
        else
        {
            console.log( JSON.stringify((await VagrantProvider.retrieveSSHConfigByName(envName) )));
        }

        return;
    }

}

module.exports = Baker;
