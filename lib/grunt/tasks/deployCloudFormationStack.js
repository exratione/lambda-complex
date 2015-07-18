/**
 * @fileOverview Grunt task deploy-cloudformation-template.
 *
 * Deploys the CloudFormation stack, and optionally cleans up the prior stack.
 */

// Local.
var common = require('../common');
var cloudFormationUtilities = require('../../deploy/cloudFormationUtilities');

module.exports = function (grunt) {
  grunt.registerTask(
    'deploy-cloudformation-stack',
    'Deploy the CloudFormation stack, and optionally destroy prior stacks.',
    function () {
      var done = this.async();
      var config = common.getConfigurationFromOptionOrFail(grunt);

      cloudFormationUtilities.deployStack(config, done);
    }
  );
};
