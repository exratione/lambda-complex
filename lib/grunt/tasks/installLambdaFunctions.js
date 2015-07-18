/**
 * @fileOverview Grunt task install-lambda-functions.
 *
 * Installs specified Lambda function packages to the build directory.
 */

// Local.
var common = require('../common');
var installUtilities = require('../../build/installUtilities');

module.exports = function (grunt) {
  grunt.registerTask(
    'install-lambda-functions',
    'Install Lambda function packages into the build directory.',
    function () {
      var done = this.async();
      var config = common.getConfigurationFromOptionOrFail(grunt);

      installUtilities.installLambdaFunctions(config, done);
    }
  );
};
