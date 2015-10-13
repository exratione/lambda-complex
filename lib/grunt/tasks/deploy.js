/**
 * @fileOverview Grunt task deploy.
 *
 * Build and deploy a Lambda Complex application as a CloudFormation stack.
 */

// Local.
var common = require('../common');
var index = require('../../../index');

module.exports = function (grunt) {
  grunt.registerTask(
    'deploy',
    'Build and deploy a Lambda Complex application as a CloudFormation stack.',
    function () {
      var done = this.async();
      var config = common.getConfigurationFromOptionOrFail(grunt);

      index.deploy(config, done);
    }
  );
};
