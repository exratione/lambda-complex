/**
 * @fileOverview Grunt task package-lambda-functions.
 *
 * Zips Lambda function packages in the application build directory.
 */

// Local.
var common = require('../common');
var packageUtilities = require('../../build/packageUtilities');

module.exports = function (grunt) {
  grunt.registerTask(
    'package-lambda-functions',
    'Zip and upload installed Lambda functions in the build directory.',
    function () {
      var done = this.async();
      var config = common.getConfigurationFromOptionOrFail(grunt);

      packageUtilities.packageLambdaFunctions(config, done);
    }
  );
};
