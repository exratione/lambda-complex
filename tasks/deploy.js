/**
 * @fileOverview Grunt task lambda-complex-deploy.
 *
 * Build and deploy a Lambda Complex application as a CloudFormation stack.
 */

// Local.
var common = require('../lib/grunt/common');
var index = require('../index');

module.exports = function (grunt) {
  grunt.registerTask(
    'lambda-complex-deploy',
    'Build and deploy a Lambda Complex application as a CloudFormation stack.',
    function () {
      var done = this.async();
      var config = common.getConfigurationFromOptionOrFail(grunt);

      index.deploy(config, done);
    }
  );
};
