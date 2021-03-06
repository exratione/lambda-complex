/**
 * @fileOverview Helpers for testing.
 */

// Core.
var path = require('path');
var util = require('util');

// NPM.
var fs = require('fs-extra');
var _ = require('lodash');

// Local.
var index = require('../../index');
var buildCommon = require('../../lib/build/common');
var utilities = require('../../lib/shared/utilities');
var constants = require('../../lib/shared/constants');

// ---------------------------------------------------------------------------
// Exported functions.
// ---------------------------------------------------------------------------

exports.getScratchDirectory = function () {
  return path.resolve(__dirname, '../scratch');
};

/**
 * Obtain a mock ARN map for an application.
 *
 * @param {Object} config The mock application config.
 * @return {Object} The ARN map.
 */
exports.getMockArnMap = function (config) {
  var arnMap = {};
  var prop;

  // Ensure that this includes values for the internal components not specified
  // explicitly in the config.
  _.each(buildCommon.getAllComponents(config), function (component) {
    // Queues for event from message type components.
    if (component.type === constants.componentType.EVENT_FROM_MESSAGE) {
      prop = utilities.getQueueArnOutputName(component.name);
      arnMap[prop] = util.format(
        'arn:aws:sqs:%s:444555666777:%s',
        config.deployment.region,
        utilities.getQueueName(component.name)
      );
    }

    // Concurrency queues for all components.
    prop = utilities.getConcurrencyQueueArnOutputName(component.name);
    arnMap[prop] = util.format(
      'arn:aws:sqs:%s:444555666777:%s',
      config.deployment.region,
      utilities.getConcurrencyQueueName(component.name)
    );

    // Lambda functions.
    prop = utilities.getLambdaFunctionArnOutputName(component.name);
    arnMap[prop] = util.format(
      'arn:aws:sqs:%s:444555666777:%s',
      config.deployment.region,
      // Can't produce a real thing here as it is auto-generated by AWS.
      'lambdaFunctionAutoGeneratedName'
    );
  });

  return arnMap;
};

/**
 * Set up a mock application in the scratch directory.
 *
 * @param {Object} config The mock application config.
 * @param {Function} callback Of the form function (error).
 */
exports.setUpMockApplication = function (config, callback) {
  // We only want to set this up once per test run to save time, but multiple
  // suites request it. Hence set a global and check it to ensure it runs only
  // once.
  if (global.mockApplicationCreated) {
    return callback();
  }

  var mockApplicationDir = path.resolve(
    exports.getScratchDirectory(),
    config.name
  );

  // Start by changing the build directory to the test scratch directory.
  sinon.stub(
    buildCommon,
    'getApplicationBuildDirectory'
  ).returns(mockApplicationDir);

  // Get rid of what was there.
  fs.removeSync(mockApplicationDir);

  // Run this through the normal build process, but with the altered directory.
  index.build(config, function (error) {
    buildCommon.getApplicationBuildDirectory.restore();
    global.mockApplicationCreated = true;
    callback(error);
  });
};

/**
 * Load the expected CloudFormation template.
 *
 * @return {Object} The expected CloudFormation template.
 */
exports.getExpectedCloudFormationTemplate = function () {
  return require(path.resolve(
    __dirname,
    'mockApplication/cloudFormation'
  ));
};

/**
 * Obtain a Sinon matcher that can compare an original configuration object with
 * one loaded from the copied configuration file.
 *
 * This requires matching the possible functions in the config object, which
 * can't be done by a straight equality since they'll be different function
 * instances.
 *
 * @param {Object} config A configuration object.
 * @return {Object} A matcher.
 */
exports.getConfigMatcher = function (expectedConfig) {

  function compareFns (fn1, fn2) {
    if (typeof fn1 === 'function' && typeof fn2 === 'function') {
      return fn1.toString() === fn2.toString();
    }

    return fn1 === fn2;
  }

  // The function provided must return true on a match, false on no match.
  return sinon.match(function (actualConfig) {
    // This covers most of it, but functions are not stringified.
    if (JSON.stringify(expectedConfig) !== JSON.stringify(actualConfig)) {
      return false;
    }

    // Check the switchover function.
    if (!compareFns(
      expectedConfig.deployment.switchoverFunction,
      actualConfig.deployment.switchoverFunction
    )) {
      return false;
    }

    // Check the routing functions.
    return _.every(expectedConfig.components, function (component, index) {
      return compareFns(
        component.routing,
        actualConfig.components[index].routing
      );
    });
  }, 'Configuration object does not match.');
};
