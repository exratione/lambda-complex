/**
 * @fileOverview Grunt task upload-lambda-functions.
 *
 * Uploads Lambda function archives from the build directory to S3.
 */

// Local.
var common = require('../common');
var s3Utilities = require('../../deploy/s3Utilities');

module.exports = function (grunt) {
  grunt.registerTask(
    'upload-lambda-functions',
    'Upload Lambda function archives from the build directory to S3.',
    function () {
      var done = this.async();
      var config = common.getConfigurationFromOptionOrFail(grunt);

      s3Utilities.uploadLambdaFunctions(config, done);
    }
  );
};
