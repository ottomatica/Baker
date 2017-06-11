const mustache = require('mustache');
const yaml = require('js-yaml');
const fs = require('fs');

var view = {
  title: "Joe",
  calc: function() {
    return 2 + 4;
  }
};

template = fs.readFileSync( "../config/BaseVM.mustache" ).toString();
let doc = yaml.safeLoad(fs.readFileSync("resources/baker.yml", 'utf8'));

var output = mustache.render(template, doc);
console.log(output);
