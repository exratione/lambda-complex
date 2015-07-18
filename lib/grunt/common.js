/**
 * @fileOverview Common code for grunt tasks.
 */

// Core.
var path = require('path');
var util = require('util');

/**
 * Return the configuration object based on a path passed in via --config-path,
 * or fail the grunt task.
 *
 * @param {Object} grunt A grunt instance.
 * @return {Object} A configuration object.
 */
exports.getConfigurationFromOptionOrFail = function (grunt) {
  var configPath = grunt.option('config-path');
  var config;

  // Is this configuration option missing?
  if (!configPath) {
    return grunt.fail.fatal(new Error(
      'The --config-path option is required, e.g.: --config-path=path/to/applicationConfig.js'
    ));
  }

  // Convert relative to absolute path.
  if (!path.isAbsolute(configPath)) {
    configPath = path.resolve(process.cwd(), configPath);
  }

  // Load the file.
  try {
    config = require(configPath);
  }
  catch (error) {
    return grunt.fail.fatal(new Error(util.format(
      'No configuration Javascript file at: %s',
      configPath
    ), error));
  }

  return config;
};
