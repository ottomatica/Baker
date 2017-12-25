const child_process = require('child_process');
const request = require('request');
const chai = require('chai');
const expect = chai.expect;

const resolve = require('../../lib/bakerlets/resolve');

describe('Baker 2 tests', function() {
    this.timeout(600000);
    it('should read baker2 file', async function() {
        await resolve.resolveBakerlet("test/resources/baker2/itrust2.yml")
    });

});