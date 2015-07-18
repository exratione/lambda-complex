/**
 * @fileOverview Grunt task generate-cloudformation-template.
 *
 * Creates the CloudFormation template and writes it to the build directory for
 * the application.
 */

// Local.
var common = require('../common');
var cloudFormationTemplateUtilities = require('../../build/cloudFormationTemplateUtilities');

module.exports = function (grunt) {
  grunt.registerTask(
    'generate-cloudformation-template',
    'Generate the CloudFormation template for the application.',
    function () {
      var done = this.async();
      var config = common.getConfigurationFromOptionOrFail(grunt);

      cloudFormationTemplateUtilities.generateTemplate(config, done);
    }
  );
};
