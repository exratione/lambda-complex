/**
 * @fileOverview CloudFormation related utilities.
 */

// NPM.
var async = require('async');
var cloudFormationDeploy = require('cloudformation-deploy');
var fs = require('fs-extra');
var _ = require('lodash');

// Local.
var common = require('../build/common');
var constants = require('../shared/constants');
var s3Utilities = require('./s3Utilities');
var utilities = require('../shared/utilities');

// ---------------------------------------------------------------------------
// Exported functions.
// ---------------------------------------------------------------------------

/**
 * Obtain a map of components to relevant ARNs (queues and Lambda functions).
 *
 * This is in essence a more compact representation of the stack description
 * outputs property.
 *
 * @param {Object[]} outputs The outputs from the stack description.
 * @param {Function} callback Of the form function (error, arnMap).
 */
exports.arnMapFromOutputs = function (outputs, callback) {
  var arnMap = {};

  if (!_.isArray(outputs) || !outputs.length) {
    return callback(new Error(
      'The stack description Outputs is empty, which should not be the case.'
    ));
  }

  _.each(outputs, function (output) {
    arnMap[output.OutputKey] = output.OutputValue;
  });

  callback(null, arnMap);
};

/**
 * Start the deployed application by invoking coordinator Lambda function
 * instances.
 *
 * @param {Object} arnMap The ARN map.
 * @param {Object} config Lambda Complex configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.startApplication = function (arnMap, config, callback) {
  var coordinatorArn = utilities.getLambdaFunctionArn(
    constants.coordinator.NAME,
    arnMap
  );
  // The coordinator doesn't need any specific event data.
  var event = {};

  // Fire up the number of coordinators specified in the configuration,
  // but space them out across the span of coordinator.minInterval.
  var timeout = 0;
  if (config.coordinator.coordinatorConcurrency > 1) {
    timeout = Math.floor(
      config.coordinator.minInterval * 1000 / config.coordinator.coordinatorConcurrency
    );
  }

  async.timesSeries(
    config.coordinator.coordinatorConcurrency,
    function (index, asyncCallback) {
      utilities.invoke(coordinatorArn, event, function (error) {
        setTimeout(function () {
          asyncCallback(error);
        }, timeout)
      });
    },
    callback
  );
};

/**
 * Wait for the initial coordinator instances to write a success file to S3.
 *
 * @param {Object} config Lambda Complex configuration.
 * @param {Function} callback Of the form function (error, arnMap).
 */
exports.awaitApplicationConfirmation = function (config, callback) {
  var confirmationFileExists = false;
  var timedOut = false;
  var timeout = (config.coordinator.minInterval + 1) * 2 * 1000;

  // Time this out after twice the standard minimum interval for a coordinator
  // that has nothing to do. That should be good enough and with margin for
  // error.
  var timeoutId = setTimeout(function () {
    timedOut = true;
  }, timeout);

  async.until(
    // The test. When it returns true, stop and trigger the callback function.
    function () {
      return confirmationFileExists || timedOut;
    },

    // Action function. Run this until the test function returns true.
    function (asyncCallback) {
      // Insert a short pause between requests.
      setTimeout(function () {
        utilities.applicationConfirmationExists(config, function (error, exists) {
          confirmationFileExists = exists;
          asyncCallback(error);
        });
      }, 2000);
    },

    // Callback function.
    function (error) {
      clearTimeout(timeoutId);

      if (error) {
        callback(error);
      }
      else if (timedOut) {
        callback(new Error(
          'Timed out waiting on application confirmation file to be created.'
        ));
      }
      else {
        callback();
      }
    }
  );
};

/**
 * Create a switchover function that performs the extra tasks we need it to
 * carry out, such as:
 *
 * - Upload the ARN map file.
 * - Start the new Lambda Complex application by invoking the coordinator.
 * - Wait for the signal that the first coordinators worked.
 *
 * @param {Object} config Lambda Complex configuration.
 * @return {Function} The hybrid switchover function.
 */
exports.getSwitchoverFunction = function (config) {
  return function (stackDescription, callback) {
    var arnMap;

    async.series({
      createArnMap: function (asyncCallback) {
        exports.arnMapFromOutputs(stackDescription.Outputs, function (error, map) {
          arnMap = map;
          asyncCallback(error);
        });
      },

      uploadArnMap: function (asyncCallback) {
        s3Utilities.uploadArnMap(arnMap, config, asyncCallback);
      },

      // Start the new application stack running by invoking the coordinator
      // Lambda function.
      startApplication: function (asyncCallback) {
        exports.startApplication(arnMap, config, asyncCallback);
      },

      // The initial coordinators should write a file to S3 if they worked as
      // expected and were able to invoke themselves.
      awaitApplicationConfirmation: function (asyncCallback) {
        exports.awaitApplicationConfirmation(config, asyncCallback);
      },

      // Lastly, if everything else worked then invoke the switchover function
      // provided in the configuration and await its completion.
      invokeProvidedSwitchoverFunction: function (asyncCallback) {
        if (typeof config.deployment.switchoverFunction === 'function') {
          config.deployment.switchoverFunction(
            stackDescription,
            config,
            asyncCallback
          );
        }
        else {
          asyncCallback();
        }
      }
    }, callback);
  };
};

/**
 * Create the configuration used by the cloudformation-deploy package.
 *
 * @param {Object} config Lambda Complex configuration.
 * @return {Object} CloudFormation Deploy configuration.
 */
exports.generateCloudFormationDeployConfig = function (config) {
  var cfdConfig = {
    baseName: config.name,
    version: config.version,
    deployId: config.deployId,

    // Timeout in minutes for the process of stack creation.
    createStackTimeoutInMinutes: 10,

    // Specify additional tags to apply to the stack. Might be missing.
    tags: config.deployment.tags,

    // Seconds to wait between each check on the progress of stack creation or
    // deletion.
    progressCheckIntervalInSeconds: 10,

    // A function invoked whenever a CloudFormation event is created during
    // stack creation or deletion. We don't use this.
    //onEventFn: function (event) {},

    // An optional function invoked after the CloudFormation stack is
    // successfully created but before any prior stack is deleted. This allows
    // for a clean switchover of resources to use the new stack.
    postCreationFn: exports.getSwitchoverFunction(config),

    // Delete past stack instances for this application on successful
    // deployment.
    priorInstance: cloudFormationDeploy.priorInstance.DELETE,
    // Delete this stack on failure to deploy.
    onFailure: cloudFormationDeploy.onFailure.DELETE
  };

  // If in development mode, then don't clean up the wreckage of failure and
  // don't delete prior application instances.
  if (config.deployment.developmentMode) {
    cfdConfig.priorInstance = cloudFormationDeploy.priorInstance.DO_NOTHING;
    cfdConfig.onFailure = cloudFormationDeploy.onFailure.DO_NOTHING;
  }

  return cfdConfig;
};

/**
 * Deploy the new stack and on success transition away from and delete any
 * prior stacks for this application.
 *
 * @param {Object} config Application configuration.
 * @param {Function} callback Of the form function (error, results).
 */
exports.deployStack = function (config, callback) {
  var cfdConfig = exports.generateCloudFormationDeployConfig(config);
  var template;
  var results;

  async.series({
    loadTemplate: function (asyncCallback) {
      fs.readFile(
        common.getCloudFormationTemplatePath(config),
        {
          encoding: 'utf8'
        },
        function (error, contents) {
          template = contents;
          asyncCallback(error);
        }
      );
    },
    deploy: function (asyncCallback) {
      cloudFormationDeploy.deploy(cfdConfig, template, function (error, _results) {
        results = _results;
        asyncCallback(error);
      });
    }
  }, function (error) {
    callback(error, results);
  });
};
