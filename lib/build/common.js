/**
 * @fileOverview Common utils for the deploy code.
 */

// Core.
var fs = require('fs');
var path = require('path');
var util = require('util');

// NPM.
var async = require('async');
var _ = require('lodash');

// Local
var constants = require('../shared/constants');
var utilities = require('../shared/utilities');

// --------------------------------------------------------------------------
// Directory and listing tools.
// --------------------------------------------------------------------------

/**
 * Obtain the absolute path to the build subdirectory for an application.
 *
 * @param {Object} config Configuration object.
 * @return {String} The absolute path.
 */
exports.getApplicationBuildDirectory = function (config) {
  return path.resolve(
    __dirname,
    '../../build',
    config.name,
    // Might be a number, and path.resolve only accepts strings.
    '' + config.deployId
  );
};

/**
 * Obtain the absolute path to the build node_modules directory for an
 * application.
 *
 * @param {Object} config Configuration object.
 * @return {String} The absolute path.
 */
exports.getApplicationBuildNodeModulesDirectory = function (config) {
  return path.join(exports.getApplicationBuildDirectory(config), 'node_modules');
};

/**
 * Obtain an array of absolute paths to the installed Lambda function NPM
 * packages for an application, in the node_modules directory, prior to their
 * being moved.
 *
 * @param {Object} config Configuration object.
 * @param {Function} callback Of the form function (error, string[]).
 */
exports.getApplicationPackageDirectories = function (config, callback) {
  var dir = exports.getApplicationBuildNodeModulesDirectory(config);

  fs.readdir(dir, function (error, subdirs) {
    if (error) {
      return callback(error);
    }

    async.map(subdirs, function (subdir, asyncCallback) {
      var absoluteDir = path.join(dir, subdir);
      fs.stat(absoluteDir, function (statError, stat) {
        if (error) {
          return asyncCallback(error);
        }

        if (stat.isDirectory()) {
          asyncCallback(null, absoluteDir);
        }
        else {
          asyncCallback();
        }
      });
    }, function (mapError, absoluteDirs) {
      callback(
        mapError,
        _.chain(absoluteDirs || []).compact().difference([
          // NPM may create a node_modules/.bin directory. Ignore that.
          path.join(dir, '.bin')
        ]).value()
      );
    });
  });
};

// --------------------------------------------------------------------------
// Path tools.
// --------------------------------------------------------------------------

/**
 * Obtain the S3 key for a zipped Lambda function NPM module.
 *
 * @param {Object} component Component definition object.
 * @param {Object} config Application configuration object.
 * @return {String} The key.
 */
exports.getComponentS3Key = function (component, config) {
  return path.join(
    utilities.getFullS3KeyPrefix(config),
    component.name + '.zip'
  );
};

/**
 * Obtain the absolute path to the zip file for a Lambda function NPM module.
 *
 * @param {Object} component Component definition object.
 * @param {Object} config Configuration object.
 * @return {String} The absolute path.
 */
exports.getComponentZipFilePath = function (component, config) {
  return path.join(
    exports.getApplicationBuildDirectory(config),
    component.name + '.zip'
  );
};

/**
 * Obtain the absolute path to the CloudFormation template for a given Lambda
 * Complex application.
 *
 * @param {Object} config Configuration object.
 * @return {String} The absolute path.
 */
exports.getCloudFormationTemplatePath = function (config) {
  return path.join(
    exports.getApplicationBuildDirectory(config),
    'cloudFormation.json'
  );
};

// --------------------------------------------------------------------------
// Configuration tools.
// --------------------------------------------------------------------------

/**
 * It is sometimes helpful to have a component definition for the coordinator.
 *
 * @return {Object} A component definition.
 */
exports.getCoordinatorComponentDefinition = function () {
  var component = _.cloneDeep(constants.coordinator.COMPONENT);

  component.lambda.npmPackage = path.resolve(
    __dirname,
    '../lambdaFunctions/coordinator'
  );
  return component;
};

/**
 * It is sometimes helpful to have a component definition for the invoker.
 *
 * @return {Object} A component definition.
 */
exports.getInvokerComponentDefinition = function () {
  var component = _.cloneDeep(constants.invoker.COMPONENT);

  component.lambda.npmPackage = path.resolve(
    __dirname,
    '../lambdaFunctions/coordinator'
  );
  return component;
};

/**
 * Return an array of all components, including internal ones.
 *
 * @param {Object} config Configuration object.
 * @return {Object[]} Component definitions.
 */
exports.getAllComponents = function (config) {
  return [
    exports.getCoordinatorComponentDefinition(),
    exports.getInvokerComponentDefinition()
  ].concat(config.components);
};

/**
 * Return an array containing the event from message type components only.
 *
 * @param {Object} config The application configuration.
 * @return {Object[]} Only event from message components.
 */
exports.getEventFromMessageComponents = function (config) {
  return _.filter(exports.getAllComponents(config), function (component) {
    return component.type === constants.componentType.EVENT_FROM_MESSAGE;
  });
}

/**
 * Given a config object generate the contents of the config.js file to be
 * included in Lambda function NPM modules.
 *
 * Since we have to include function definitions this isn't as simple as just
 * generating JSON.
 *
 * @param {Object} config The application configuration.
 * @return {String} Contents to be written to a file.
 */
exports.generateConfigContents = function (config) {
  var token = '__ROUTING_FN_%s__';
  var quotedToken = '"' + token + '"';
  var routingFns = [];
  var switchoverFn;
  var switchoverToken = '__SWITCHOVER_FN__';
  var quotedSwitchoverToken = '"' + switchoverToken + '"';

  // Take a copy to manipulate.
  config = _.cloneDeep(config);

  // Replace the switchover function with a token.
  if (config.deployment.switchoverFunction) {
    switchoverFn = config.deployment.switchoverFunction;
    config.deployment.switchoverFunction = switchoverToken;
  }

  // Replace all of the routing functions with string tokens.
  _.each(config.components, function (component) {
    if (typeof component.routing !== 'function') {
      return;
    }

    var index = routingFns.length;
    routingFns[index] = component.routing;
    component.routing = util.format(token, index);
  });

  // Generate the content, dropping any remaining functions such as the
  // switchoverFunction.
  var contents = util.format(
    'module.exports = %s;',
    JSON.stringify(config, null, '  ')
  );

  // Now replace the tokens with string representations of the replaced
  // routing functions.
  if (switchoverFn) {
    contents = contents.replace(quotedSwitchoverToken, switchoverFn.toString());
  }

  _.each(routingFns, function (fn, index) {
    contents = contents.replace(
      util.format(quotedToken, index),
      fn.toString()
    );
  });

  return contents;
};
