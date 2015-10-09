/**
 * @fileOverview Coordinator handler implementation.
 */

// Core.
var util = require('util');

// Other NPM packages.
var async = require('async');
var _ = require('lodash');

// Local.
var common = require('./common');
// The coordinator expects that the build process will have placed _config.js in
// the same directory as this file.
var config = require('./_config');
// Expect lambda-complex application constants to be placed in _constants.js.
var constants = require('./_constants');
// Expect lambda-complex application utilities to be placed in _utilities.js.
var utilities = require('./_utilities');

// ---------------------------------------------------------------------------
// Properties.
// ---------------------------------------------------------------------------

// Will be set by the handler before any other action.
exports.arnMap = undefined;

// ---------------------------------------------------------------------------
// Functions.
// ---------------------------------------------------------------------------

/**
 * Obtain data on the application status.
 *
 * The response is of the form:
 *
 * {
 *   components: [
 *     {
 *       name: 'functionX',
 *       type: 'eventFromMessage',
 *       // For eventFromMessage type.
 *       queuedMessageCount: 0
 *     },
 *     ...
 *   ]
 * }
 *
 * @param {Function} callback Of the form function (error, status).
 */
exports.determineApplicationStatus = function (callback) {
  var status = {
    components: []
  };

  var fns = _.map(config.components, function (component) {
    return function (innerCallback) {
      var data = {
        name: component.name,
        type: component.type
      };
      status.components.push(data);

      if (component.type !== constants.componentType.EVENT_FROM_MESSAGE) {
        return innerCallback();
      }

      utilities.getQueueAttributes(
        utilities.getQueueUrl(component.name, exports.arnMap),
        function (error, attributes) {
          // Just log the error for an individual failed request, don't pass it
          // back out to the final callback.
          if (error) {
            console.error(error);
            data.queuedMessageCount = 0;
          }
          else {
            data.queuedMessageCount = attributes.ApproximateNumberOfMessages;
          }
          innerCallback();
        }
      );
    };
  });

  common.executeConcurrently(
    fns,
    config.coordinator.maxApiConcurrency,
    function (error) {
      callback(error, status);
    }
  );
};

// ---------------------------------------------------------------------------
// Lamdbda handler function.
// ---------------------------------------------------------------------------

/**
 * Acts as a coordinator to:
 *
 * - View queue message counts in the application status.
 * - Invoke invokers and other Lambda functions for queues with messages.
 *
 * @param {Object} event Event instance.
 * @param {Object} context Lambda context instance.
 */
exports.handler = function (event, context) {
  var startTime = new Date().getTime();
  var applicationStatus;
  var invocationCounts;

  // Load the ARN map first of all.
  utilities.loadArnMap(config, function (error, arnMap) {
    exports.arnMap = arnMap;

    // If this errors out, we can't do anything, not even invoke this function
    // again. So log and exit immediately.
    if (error) {
      console.error('Failed to load ARN map, aborting immediately.', error);
      return context.done(error);
    }

    async.series([
      // Obtain the application status and derived data.
      function (asyncCallback) {
        exports.determineApplicationStatus(function (error, status) {
          if (error) {
            return asyncCallback(error);
          }

          applicationStatus = status;
          invocationCounts = common.getInvocationCounts(applicationStatus);

          console.info(util.format(
            'Coodinator: application status: %s\ninvocation counts: %s',
            JSON.stringify(applicationStatus),
            JSON.stringify(invocationCounts)
          ));

          asyncCallback();
        });
      },
      // Next take that data and make API requests to launch other functions as
      // needed.
      function (asyncCallback) {
        common.invokeApplicationLambdaFunctions(
          invocationCounts,
          exports.arnMap,
          asyncCallback
        );
      },
      // If there is time left to wait before the next invocation of the
      // coordinator, then wait.
      function (asyncCallback) {
        common.ensureInterval(
          startTime,
          // Seconds to milliseconds.
          config.coordinator.minInterval * 1000,
          context,
          asyncCallback
        );
      }
    ], function (error) {
      if (error) {
        console.error(error);
      }

      console.info('Invoking self.');

      var coordinatorArn = utilities.getLambdaFunctionArn(
        constants.coordinator.NAME,
        exports.arnMap
      );

      utilities.invoke(coordinatorArn, event, function (invokeError) {
        if (invokeError) {
          console.error(invokeError);
        }

        context.done(error || invokeError, applicationStatus);
      });
    });
  });
};
