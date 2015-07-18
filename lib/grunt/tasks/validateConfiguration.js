/**
 * @fileOverview Grunt task validate-config-option.
 *
 * Validates that configuration is provided and is valid.
 */

// NPM.
var util = require('util');

// Local.
var common = require('../common');
var configValidator = require('../../build/configValidator');

/**
 * Validate the provided application configuration.
 */
module.exports = function (grunt) {
  grunt.registerTask(
    'validate-configuration',
    'Validate that a configuration file is specified and valid.',
    function () {
      var config = common.getConfigurationFromOptionOrFail(grunt);
      var errors = configValidator.validate(config);

      if (errors.length) {
        grunt.fail.fatal(new Error(util.format(
          'Provided configuration has the following errors: %s',
          JSON.stringify(errors, null, '  ')
        )));
      }
    }
  );

};
