/**
 * @fileOverview Expose a programmatic interface for using Lambda Complex.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');
var Janitor = require('cloudwatch-logs-janitor');
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
    // Clear out the build directory for this application.
    clean: function (asyncCallback) {
      fs.remove(common.getApplicationBuildDirectory(config), asyncCallback);
    },

    // Download or copy the NPM packages containing Lambda function handlers.
    install: function (asyncCallback) {
      installUtilities.installLambdaFunctions(config, asyncCallback);
    },

    // Zip up the NPM packages.
    package: function (asyncCallback) {
      packageUtilities.packageLambdaFunctions(config, asyncCallback);
    },

    // Create the CloudFormation template for this application deployment.
    generateCloudFormationTemplate: function (asyncCallback) {
      cloudFormationTemplateUtilities.generateTemplate(config, asyncCallback);
    }
  }, callback);
};

/**
 * Build and deploy a Lambda Complex application.
 *
 * @param {Object} config The application configuration.
 * @param {Function} callback Of the form function (error, results).
 */
exports.deploy = function (config, callback) {
  var startTime = new Date();
  var results;

  async.series({
    // Run the build task.
    build: function (asyncCallback) {
      exports.build(config, asyncCallback);
    },

    // Take the packaged Lambda functions and upload them to S3.
    uploadLambdaFunctions: function (asyncCallback) {
      s3Utilities.uploadLambdaFunctions(config, asyncCallback);
    },

    // Upload the configuration to S3.
    //
    // The application doesn't use this config file instance, rather loading
    // config files from the packages, but keeping a record of it in S3
    // alongside the other files for each deployment seems like a smart idea.
    uploadConfig: function (asyncCallback) {
      s3Utilities.uploadConfig(config, asyncCallback);
    },

    // Now on to the actual CloudFormation deployment, including the activities
    // needed to switch over resources to use the new application, and deletion
    // of old stacks.
    deployCloudFormationStack: function (asyncCallback) {
      cloudFormationUtilities.deployStack(config, function (error, _results) {
        results = _results;
        asyncCallback(error);
      });
    },

    // Every Lambda function generates a CloudWatch log group, and this can
    // build up clutter pretty quickly during development. Some people may
    // prefer to keep the old groups around for production deployments.
    deletePriorCloudwatchLogGroups: function (asyncCallback) {
      if (config.deployment.skipPriorCloudWatchLogGroupsDeletion) {
        return asyncCallback();
      }

      // This will use AWS config from the environment, like the rest of Lambda
      // Complex.
      var janitor = new Janitor();

      janitor.deleteMatchingLogGroups({
        // Using this should be sufficient to avoid deleting log groups for
        // the just-deployed Lambda functions.
        createdBefore: startTime,
        // Lambda function log groups for this application will have names that
        // begin with this prefix.
        prefix: '/aws/lambda/' + config.name + '-'
      }, function (error) {
        // Cleaning up old log groups may require a bunch of API requests, and
        // these have in the past proven to be somewhat flaky and/or subject to
        // very low throttling levels. Failure here isn't critical, as anything
        // that is missed will be addressed by the next deployment. So just add
        // the error to the results.
        if (error) {
          results.cloudWatchLogDeletionError = error;
        }

        asyncCallback();
      });
    }
  }, function (error) {
    callback(error, results);
  });
};
