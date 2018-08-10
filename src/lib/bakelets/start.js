const Ssh = require('../modules/ssh');

async function start(cmd, vmName, ansibleSSHConfig, verbose) {
    //await ssh.sshExec(`nohup bash -c '${cmd}' & exit 0`, sshConfig, true);
    // await ssh.sshExec(`nohup bash -c "${cmd}" > ~/start.out 2> ~/start.err &`, vmSSHConfig, verbose);
    // https://stackoverflow.com/questions/29142/getting-ssh-to-execute-a-command-in-the-background-on-target-machine
    // can consider a keepalive option for start if want to see the output without redirecting.

    await Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${vmName} && ansible all -m shell -a 'nohup bash -c "${cmd}" > ~/start.out 2> ~/start.err &' -i baker_inventory -v`, ansibleSSHConfig, verbose);
}

module.exports = start;
