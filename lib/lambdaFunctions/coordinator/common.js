/**
 * @fileOverview Common functionality.
 */

// Other NPM.
var async = require('async');
var _ = require('lodash');

// Local.
//
// The coordinator expects that the build process will have placed _config.js in
// the same directory as this file.
var config = require('./_config');
// Expect lambda-complex application constants to be placed in _constants.js.
var constants = require('./_constants');
// Expect lambda-complex application utilities to be placed in _utilities.js.
var utilities = require('./_utilities');

// ---------------------------------------------------------------------------
// Utility functions.
// ---------------------------------------------------------------------------

/**
 * Wait for as much time is needed to make up the remainder of the interval,
 * given how much time has elapsed already since this lambda function was
 * invoked.
 *
 * @param {Number} startTime Timestamp for the invocation start.
 * @param {Number} interval Interval to wait in milliseconds.
 * @param {Object} context Lambda context instance.
 * @param {Function} callback
 */
exports.ensureInterval = function (startTime, interval, context, callback) {
  var elapsed = new Date().getTime() - startTime;
  var remainingWaitTime = Math.max(0, interval - elapsed);

  // Make sure we don't overshoot the hard time limits. So check how long is
  // left and subtract an extra five seconds to allow enough time to wrap up and
  // sort out the remaining tasks, like invoking another instance of this lambda
  // function.
  var remainingLimitTime = Math.max(0, context.getRemainingTimeInMillis() - 5000);
  if (remainingWaitTime > remainingLimitTime) {
    remainingWaitTime = remainingLimitTime;
  }

  setTimeout(callback, remainingWaitTime);
};

/**
 * Provide an array of all components, including internal ones.
 *
 * Note that this somewhat replicates functionality in lib/build/common.js, but
 * there are differences between the two.
 */
exports.getAllComponents = function () {
  return [
    _.cloneDeep(constants.coordinator.COMPONENT),
    _.cloneDeep(constants.invoker.COMPONENT)
  ].concat(config.components);
};

// ---------------------------------------------------------------------------
// Flow control.
// ---------------------------------------------------------------------------

/**
 * Execute the provided async functions concurrently, but no more than the
 * provided concurrency limit at any one time.
 *
 * Failures are logged but will not disrupt ongoing execution.
 *
 * @param {Function[]} fns Functions to execute, of the form fn(callback).
 * @param {Function} callback Of the form callback (error).
 */
exports.executeConcurrently = function (fns, concurrency, callback) {
  if (!fns.length) {
    return callback();
  }

  var queue = async.queue(function (fn, asyncCallback) {
    fn(asyncCallback);
  }, concurrency);

  queue.drain = _.once(callback);

  function onTaskCompletion (error) {
    if (error) {
      console.error(error);
    }
  }

  _.each(fns, function (fn) {
    queue.push(fn, onTaskCompletion);
  });
};

// ---------------------------------------------------------------------------
// Invocation count functions.
// ---------------------------------------------------------------------------

/**
 * Produce invocation counts from the application status. This determines
 * which event from message type Lambda functions should be invoked and how many
 * times each.
 *
 * [
 *   { name: 'componentName', count: 10 },
 *   ...
 * ]
 *
 * The invocation counts are limited by the maxConcurrency specified in the
 * component definition.
 *
 * Further when there are multiple coordinators each only does its share of the
 * work. For two coordinators, each does half, for example.
 *
 * @param {Object} status Application status.
 * @return {Object[]} The invocation counts.
 */
exports.getInvocationCounts = function (status) {
  return _.chain(status.components).filter(function (component) {
    return (
      // We only run this for event from message components.
      (component.type === constants.componentType.EVENT_FROM_MESSAGE) &&
      // This is only a number when the check on queue size worked. If it
      // didn't work, we choose to do nothing for that component this time.
      // The error will have been logged when it occurred.
      (typeof component.queuedMessageCount === 'number') &&
      // This is only a number when the concurrency count check worked. If it
      // didn't work, we choose to do nothing for that component this time.
      // The error will have been logged when it occurred.
      (typeof component.concurrency === 'number')
    );
  }).map(function (component) {
    var count = Math.min(
      // How many messages to act on.
      component.queuedMessageCount,
      // How much space we have left for concurrent invocations.
      Math.max(0, component.maxConcurrency - component.concurrency)
    );

    // Next cut down the count by the coordinator concurrency; each coordinator
    // only does its share of the work. For two coordinators, each does half.
    //
    // If there are fractional counts, then we round up and just do more. This
    // is most pronounced at low levels of activity, where every coordinator
    // will chase the same message if they are in sequence.
    //
    // The alternative is to randomize odds, which may lead to a message
    // lingering and adds to complexity.
    count = Math.ceil(count / config.coordinator.coordinatorConcurrency);

    return {
      name: component.name,
      count: count
    };
  }).value();
};

/**
 * Sum the counts in the invocation count objects provided.
 *
 * [
 *   { name: 'componentName', count: 10 },
 *   ...
 * ]
 *
 * @param  {[type]} invocationCounts The invocation counts.
 * @return {Number} The sum.
 */
exports.sumOfInvocationCounts = function (invocationCounts) {
  return _.reduce(invocationCounts, function (sum, invocationCount) {
    return sum + invocationCount.count;
  }, 0);
};

/**
 * Split up invocation counts into sets. Returns the following format:
 *
 * {
 *   // What to execute locally.
 *   localInvoker: [
 *     { name: 'componentName', count: 10 },
 *     ...
 *   ],
 *   // What to pass on to other invokers, split into groups of a size of
 *   // maxInvocationCount.
 *   otherInvoker: [
 *     [
 *       { name: 'componentName', count: 10 },
 *       ...
 *     ]
 *     ...
 *
 *   ]
 * }
 *
 * @param {Object[]} invocationCounts
 * @return {Object} The desired arrangement of invocations.
 */
exports.splitInvocationCounts = function (invocationCounts) {
  var split = {
    localInvoker: [],
    otherInvoker: []
  };
  var remainingTotalCount = exports.sumOfInvocationCounts(invocationCounts);
  var maxInvocationCount = config.coordinator.maxInvocationCount;

  // Cloning to ensure we don't mess anything up while manipulating this.
  invocationCounts = _.cloneDeep(invocationCounts);

  // If there are few enough invocations to run in this instance, then things
  // are simple - just allot them to the local bucket and return.
  if (remainingTotalCount <= maxInvocationCount) {
    split.localInvoker = invocationCounts;
    return split;
  }

  // Otherwise pull out lumps of maxInvocationCount a maximum number of times
  // equal to (maxInvocationCount - 1) for sending to another invoker. Do this
  // until left with a remainder that is either small enough to run or large
  // enough to be sent on.
  do {
    var pulledCounts = [];
    var invocationCount;
    var spaceLeftInInvoker = maxInvocationCount;

    while (spaceLeftInInvoker > 0 && invocationCounts.length) {
      invocationCount = _.last(invocationCounts);

      // If there's a larger count than the target invoker can handle,
      // considering what we've already assigned, then split out
      // maxInvocationCount from it, and reduce its count by that much.
      if (invocationCount.count > spaceLeftInInvoker) {
        invocationCount.count -= spaceLeftInInvoker;

        // Remove from the components array if this empties it.
        if (invocationCount.count === 0) {
          invocationCounts.pop();
        }

        var copy = _.clone(invocationCount);
        copy.count = spaceLeftInInvoker;
        pulledCounts.push(copy);
      }
      // Otherwise pull the whole thing and remove it from the array.
      else {
        invocationCounts.pop();
        pulledCounts.push(invocationCount);
      }

      // Update the remaining space count.
      spaceLeftInInvoker = maxInvocationCount - exports.sumOfInvocationCounts(
        pulledCounts
      );
    }

    // Add the pulled counts to the bucket of those intended to be send on to
    // other invokers.
    split.otherInvoker.push(pulledCounts);

    // Update the count for the loop check.
    remainingTotalCount = exports.sumOfInvocationCounts(invocationCounts);
  } while (
    remainingTotalCount > maxInvocationCount &&
    split.otherInvoker.length < maxInvocationCount - 1
  )

  // Now we're left with whatever is left. Is it small enough to run here?
  if (remainingTotalCount <= maxInvocationCount - split.otherInvoker.length) {
    split.localInvoker = invocationCounts;
  }
  // Otherwise send it on to another invoker.
  else {
    split.otherInvoker.push(invocationCounts);
  }

  return split;
};

// ---------------------------------------------------------------------------
// Clarifying invocation wrappers.
// ---------------------------------------------------------------------------

/**
 * Launch a Lambda function instance for an "event from message" component.
 *
 * This needs no data passed to it, as it will pull its data from its queue.
 *
 * @param {Object} name The component name.
 * @param {Object} arnMap The ARN map.
 * @param {Function} callback Of the form function (error).
 */
exports.invokeEventFromMessageFunction = function (name, arnMap, callback) {
  // Empty payload; no event needs passing to this invocation.
  var payload = {};
  utilities.invoke(
    utilities.getLambdaFunctionArn(name, arnMap),
    payload,
    callback
  );
};

/**
 * Launch an instance of an invoker, and pass a set of invocation counts for
 * event from message Lambda functions. The invoker is then responsible for
 * invoking them.
 *
 * The form of the invocation counts is:
 *
 * [
 *   { name: 'component1', count: 10 },
 *   ...
 * ]
 *
 * @param {Object[]} invocationCounts The invocation count data.
 * @param {Object} arnMap The ARN map.
 * @param {Function} callback Of the form function (error).
 */
exports.invokeInvoker = function (invocationCounts, arnMap, callback) {
  // Empty payload; no event needs passing to this invocation.
  utilities.invoke(
    utilities.getLambdaFunctionArn(constants.invoker.NAME, arnMap),
    {
      components: invocationCounts
    },
    callback
  );
};

/**
 * Invoke invoker and other Lambda functions as needed to process queue
 * contents.
 *
 * The form of the invocation counts is:
 *
 * [
 *   { name: 'component1', count: 10 },
 *   ...
 * ]
 *
 * @param {Object[]} invocationCounts Data on which functions are to be invoked.
 * @param {Object} arnMap The ARN map.
 * @param {Function} callback Of the form function (error).
 */
exports.invokeApplicationLambdaFunctions = function (invocationCounts, arnMap, callback) {
  var split = exports.splitInvocationCounts(invocationCounts);
  var fns = [];

  // Local direct invocations of application Lambda functions, many times over.
  _.each(split.localInvoker, function (invocationCount) {
    _.times(invocationCount.count, function () {
      fns.push(function (asyncCallback) {
        exports.invokeEventFromMessageFunction(
          invocationCount.name,
          arnMap,
          asyncCallback
        );
      });
    });
  });

  // Launch other invokers to invoke specific functions many times.
  fns = fns.concat(
    _.map(split.otherInvoker, function (invocationCountSet) {
      return function (asyncCallback) {
        exports.invokeInvoker(invocationCountSet, arnMap, asyncCallback);
      };
    })
  );

  exports.executeConcurrently(
    fns,
    config.coordinator.maxApiConcurrency,
    callback
  );
};
