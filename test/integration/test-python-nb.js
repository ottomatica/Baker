const child_process = require('child_process');
const request = require('request');
const chai = require('chai');
const expect = chai.expect;
const os = require('os');
const path = require('path');
const fs = require('fs-extra');

describe('baker should create python notebook', function() {
    this.timeout(1000000);

    // https://github.ncsu.edu/engr-csc326-staff/Onboarding

    it('should setup python notebook', function(done) {
        const tstDir = path.join(os.tmpdir(), 'python-nb');
        fs.mkdirpSync(tstDir);
        fs.copySync('test/resources/baker2/python-notebook.yml', path.join(tstDir,'baker.yml'));
        // echo value for prompt input for password.
        var child = child_process.exec(`baker bake --local ${tstDir}`, 
                                       {cwd: os.tmpdir()  }, function(error, stdout, stderr) 
        {
            console.log(stderr || stdout);
            done();
        });
        child.stdout.pipe(process.stdout);
    });
});


