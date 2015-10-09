/**
 * @fileOverview Invoker handler implementation.
 */

// Core.
var util = require('util');

// Local.
var common = require('./common');
// The coordinator expects that the build process will have placed _config.js in
// the same directory as this file.
var config = require('./_config');
// Expect lambda-complex application utilities to be placed in _utilities.js.
var utilities = require('./_utilities');

// ---------------------------------------------------------------------------
// Lamdbda handler function.
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

  utilities.loadArnMap(config, function (error, arnMap) {
    if (error) {
      return context.done(error);
    }

    console.info(util.format(
      'Invoker: invocation counts: %s',
      JSON.stringify(invocationCounts)
    ));

    common.invokeApplicationLambdaFunctions(
      invocationCounts,
      arnMap,
      function (invokeError) {
        context.done(invokeError);
      }
    );
  });
};
