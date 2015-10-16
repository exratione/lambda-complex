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
 *       // A roughly accurate count of how many Lamda functions are presently
 *       // running for this component.
 *       concurrency: 1,
 *       // For eventFromMessage type only.
 *       maxConcurrency: 10,
 *       queuedMessageCount: 0
 *     },
 *     ...
 *   ]
 * }
 *
 * @param {Function} callback Of the form function (error, status).
 */
exports.determineApplicationStatus = function (callback) {
  var allComponents = common.getAllComponents();
  var dataByName = {};
  var status = {
    components: []
  };

  _.each(allComponents, function (component) {
    var data = {
      name: component.name,
      type: component.type,
      concurrency: null
    };

    if (component.type === constants.componentType.EVENT_FROM_MESSAGE) {
      data.maxConcurrency = component.maxConcurrency;
      data.queuedMessageCount = null;
    }

    dataByName[component.name] = data;
    status.components.push(data);
  });

  // For all components, look at the concurrency queue message count, which
  // indicates how many Lambda functions are running.
  var fns = _.map(allComponents, function (component) {
    return function (mapCallback) {
      utilities.getQueueMessageCount(
        utilities.getConcurrencyQueueUrl(component.name, exports.arnMap),
        function (error, count) {
          // Just log the error for an individual failed request.
          if (error) {
            console.error(error);
          }
          else {
            dataByName[component.name].concurrency = count;
          }

          mapCallback();
        }
      );
    };
  });

  // For event from message type components, check the status of the queue that
  // feeds the component.
  fns = fns.concat(
    _.chain(allComponents).filter(function (component) {
      return component.type === constants.componentType.EVENT_FROM_MESSAGE;
    }).map(function (component) {
      return function (mapCallback) {
        utilities.getQueueMessageCount(
          utilities.getQueueUrl(component.name, exports.arnMap),
          function (error, count) {
            // Just log the error for an individual failed request.
            if (error) {
              console.error(error);
            }
            else {
              dataByName[component.name].queuedMessageCount = count;
            }

            mapCallback();
          }
        );
      };
    }).value()
  );

  common.executeConcurrently(
    fns,
    config.coordinator.maxApiConcurrency,
    function (error) {
      callback(error, status);
    }
  );
};

/**
 * Given the application status, launch additional coordinator instances if
 * needed. This helps to repair an application with multiple coordinators and
 * where one more have failed to invoke their successors.
 *
 * @param {Object} applicationStatus The application status.
 * @param {Object} event The event passed in to this instance handler.
 * @param {Function} callback Of the form function (error, status).
 */
exports.ensureCoordinatorConcurrency = function (applicationStatus, event, callback) {
  // Don't run this on the first generation coordinators, as the application
  // is still starting up and the coordinator launch is staggered.
  if (event.generation < 2) {
    return callback();
  }

  var coordinator = _.find(applicationStatus.components, function (component) {
    return (
      component.name === constants.coordinator.NAME &&
      component.type === constants.componentType.INTERNAL
    );
  });

  // If we don't have the necessary data, then skip this.
  if (typeof coordinator.concurrency !== 'number') {
    return callback();
  }

  // If we have enough coordinators, then skip this.
  if (coordinator.concurrency >= config.coordinator.coordinatorConcurrency) {
    return callback();
  }

  var arn = utilities.getLambdaFunctionArn(
    constants.coordinator.NAME,
    exports.arnMap
  );

  async.times(
    config.coordinator.coordinatorConcurrency - coordinator.concurrency,
    function (index, timesCallback) {
      utilities.invoke(arn, event, timesCallback);
    },
    callback
  );
};

// ---------------------------------------------------------------------------
// Lambda handler function.
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

  // Ensure that we're tracking generation: the count in the chain of
  // coordinator Lambda function instances invoking themselves.
  event.generation = event.generation || 0;
  event.generation++;

  async.series([
    // Load the ARN map first of all.
    function (asyncCallback) {
      utilities.loadArnMap(config, function (error, arnMap) {
        exports.arnMap = arnMap;

        // If this errors out, we can't do anything, not even invoke this
        // Lambda function again. So log and exit immediately.
        if (error) {
          console.error(
            'Critical: failed to load ARN map, aborting immediately.',
            error
          );
          return context.done(error);
        }

        asyncCallback();
      });
    },

    // Increment the concurrency count.
    function (asyncCallback) {
      utilities.incrementConcurrencyCount(
        constants.coordinator.COMPONENT,
        exports.arnMap,
        function (error) {
          asyncCallback(error);
        }
      );
    },

    // Obtain the application status and derived data.
    function (asyncCallback) {
      exports.determineApplicationStatus(function (error, status) {
        if (error) {
          return asyncCallback(error);
        }

        applicationStatus = status;
        invocationCounts = common.getInvocationCounts(applicationStatus);

        console.info(util.format(
          'Generation: %s\nApplication status: %s\nInvocation counts: %s',
          event.generation,
          JSON.stringify(applicationStatus),
          JSON.stringify(invocationCounts)
        ));

        asyncCallback();
      });
    },

    // Ensure that we have enough coordinators running concurrently. This helps
    // rescue the application from any unexpected issues that might prevent a
    // coordinator from invoking its successor.
    function (asyncCallback) {
      exports.ensureCoordinatorConcurrency(
        applicationStatus,
        event,
        asyncCallback
      );
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
    },

    // Decrement the concurrency count.
    //
    // It isn't a disaster if this doesn't happen due to earlier errors - it
    // just means the count is one high until the message expires, which should
    // happen fairly rapidly.
    function (asyncCallback) {
      utilities.decrementConcurrencyCount(
        constants.coordinator.COMPONENT,
        exports.arnMap,
        asyncCallback
      );
    }
  ], function (error) {
    // Here on in we have to get to the decrement and the invocation of the next
    // coordinator instance regardless of issues, so errors are logged only.
    if (error) {
      console.error(error);
    }

    console.info('Invoking the next coordinator.');

    utilities.invoke(
      utilities.getLambdaFunctionArn(
        constants.coordinator.NAME,
        exports.arnMap
      ),
      // The event passes on with event.generation, which will be incremented by
      // the next coordinator instance.
      event,
      function (invokeError) {
        if (invokeError) {
          console.error(
            'Critical: failed to invoke next coordinator.',
            invokeError
          );
        }

        // On the first generation upload the application confirmation file
        // if there is no error.
        //
        // Lack of an uploaded confirmation file will be considered a failure to
        // deploy, which is as it should be.
        if (error || invokeError || event.generation > 1) {
          context.done(
            error || invokeError,
            applicationStatus
          );
        }
        else {
          utilities.uploadApplicationConfirmation(config, function (uploadError) {
            console.error(
              'Critical: failed to upload application confirmation file.',
              uploadError
            );

            context.done(
              uploadError,
              applicationStatus
            );
          });
        }
      }
    );
  });
};
