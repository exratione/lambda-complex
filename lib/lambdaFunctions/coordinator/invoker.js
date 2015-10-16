/**
 * @fileOverview Invoker handler implementation.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');

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
// Lambda handler function.
// ---------------------------------------------------------------------------

/**
 * An invoker instance is responsible for invoking multiple instances of one or
 * more component Lambda functions. In effect this is just an amplifier to allow
 * large numbers of invocations to be carried out given that each instance is
 * limited in how many invocations it can make.
 *
 * If asked to invoke too many Lambda function instances, this instance will
 * invoke other invoker instances.
 *
 * This is only used to invoke components that are checking a queue in order to
 * obtain concurrency of message processing.
 *
 * This expects an event of the form:
 *
 * {
 *   components: [
 *     {
 *       name: 'componentName',
 *       count: 10
 *     },
 *     ...
 *   ]
 * }
 *
 * @param {Object} event Event instance.
 * @param {Object} context Lambda context instance.
 */
exports.handler = function (event, context) {
  event = event || {};
  var invocationCounts = event.components || [];
  var incremented;
  var arnMap;

  console.info(util.format(
    'Invocation counts: %s',
    JSON.stringify(invocationCounts)
  ));

  async.series([
    // Load the ARN map first of all.
    function (asyncCallback) {
      utilities.loadArnMap(config, function (error, loadedArnMap) {
        arnMap = loadedArnMap;
        asyncCallback(error);
      });
    },

    // Increment the concurrency count.
    function (asyncCallback) {
      utilities.incrementConcurrencyCount(
        constants.invoker.COMPONENT,
        arnMap,
        function (error) {
          if (error) {
            console.error(error);
            incremented = false;
          }
          else {
            incremented = true;
          }

          // Success or failure, continue. The increment isn't important enough
          // to abort on failure.
          asyncCallback();
        }
      );
    },

    // Get on with the invoking.
    function (asyncCallback) {
      common.invokeApplicationLambdaFunctions(
        invocationCounts,
        arnMap,
        asyncCallback
      );
    },

    // Decrement the concurrency count.
    //
    // It isn't a disaster if this doesn't happen due to earlier errors - it
    // just means the count is one high until the message expires, which should
    // happen fairly rapidly.
    function (asyncCallback) {
      if (!incremented) {
        return asyncCallback();
      }

      utilities.decrementConcurrencyCount(
        constants.invoker.COMPONENT,
        arnMap,
        asyncCallback
      );
    }
  ], function (error) {
    if (error) {
      console.error(error);
    }

    context.done(error, invocationCounts);
  });
};
