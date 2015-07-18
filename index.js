/**
 * @fileOverview Expose a programmatic interface for using Lambda Complex.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');
var fs = require('fs-extra');

// Local.
var common = require('./lib/build/common');
var configValidator = require('./lib/build/configValidator');
var installUtilities = require('./lib/build/installUtilities');
var packageUtilities = require('./lib/build/packageUtilities');
var cloudFormationTemplateUtilities = require('./lib/build/cloudFormationTemplateUtilities');
var cloudFormationUtilities = require('./lib/deploy/cloudFormationUtilities');
var s3Utilities = require('./lib/deploy/s3Utilities');

/**
 * Build a Lambda Complex application.
 *
 * @param {Object} config The application configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.build = function (config, callback) {
  // Validate the configuration first of all.
  var results = configValidator.validate(config);
  if (results.length) {
    return callback(new Error(util.format(
      'Invalid configuration: %s',
      JSON.stringify(results, null, '  ')
    )));
  }

  async.series({
    clean: function (asyncCallback) {
      fs.remove(common.getApplicationBuildDirectory(config), asyncCallback);
    },
    install: function (asyncCallback) {
      installUtilities.installLambdaFunctions(config, asyncCallback);
    },
    package: function (asyncCallback) {
      packageUtilities.packageLambdaFunctions(config, asyncCallback);
    },
    generateCloudFormationTemplate: function (asyncCallback) {
      cloudFormationTemplateUtilities.generateTemplate(config, asyncCallback);
    }
  }, callback);
};

/**
 * Deploy a built Lambda Complex application.
 *
 * @param {Object} config The application configuration.
 * @param {Function} callback Of the form function (error, results).
 */
exports.deploy = function (config, callback) {
  var results;

  // Validate the configuration first of all.
  var validationErrors = configValidator.validate(config);
  if (validationErrors.length) {
    return callback(new Error(util.format(
      'Invalid configuration: %s',
      JSON.stringify(validationErrors, null, '  ')
    )));
  }

  async.series({
    uploadLambdaFunctions: function (asyncCallback) {
      s3Utilities.uploadLambdaFunctions(config, asyncCallback);
    },
    deployCloudFormationStack: function (asyncCallback) {
      cloudFormationUtilities.deployStack(config, function (error, _results) {
        results = _results;
        asyncCallback(error);
      });
    }
  }, function (error) {
    callback(error, results);
  });
};
