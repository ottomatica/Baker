const child_process = require('child_process');
const request = require('request');
const chai = require('chai');
const expect = chai.expect;
const os = require('os');
const path = require('path');
const fs = require('fs-extra');

describe('baker should create coffeemaker, run it, and destroy it', function() {
    this.timeout(1000000);

    // https://github.ncsu.edu/engr-csc326-staff/Onboarding

    it('should run coffeemaker project', function(done) {
        const tstDir = path.join(os.tmpdir(), 'Onboarding');
        fs.remove(tstDir);
        // echo value for prompt input for password.
        var child = child_process.exec('echo 326 | baker bake2 --repo https://github.ncsu.edu/engr-csc326-staff/Onboarding', 
                                       {cwd: os.tmpdir()  }, function(error, stdout, stderr) {
            expect(stderr).to.be.empty;

            var options = {
                url: "http://192.168.8.8:8080/",
                method: 'GET'
            };

            request(options, function (error, response, body)
            {
                console.log(error || body);
                done();
            });

        });
        child.stdout.pipe(process.stdout);
        // Read prompts
        //process.stdin.pipe(child.stdin);
        //child.on('close', function (code) {
        //    callback(code, 'closing callback');
        //    // resume the main process stdin after child ends so the repl continues to run
        //    process.stdin.resume();
        //});        
    });

    /*it('should destroy VM', function(done) {
        var child = child_process.exec('node cmd.js destroy onboard', function(error, stdout, stderr)
        {
            console.log(stderr);
            expect(stderr).to.be.empty;
            done();
        });
        child.stdout.pipe(process.stdout);
    });
    */

});
