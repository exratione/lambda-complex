/**
 * @fileOverview Common utils for the deploy code.
 */

// Core.
var fs = require('fs');
var path = require('path');

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
  return {
    name: constants.coordinator.NAME,
    type: constants.componentType.INTERNAL,
    lambda: {
      npmPackage: path.resolve(
        __dirname,
        '../lambdaFunctions/coordinator'
      ),
      handler: constants.coordinator.HANDLE,
      memorySize: constants.coordinator.MEMORY_SIZE,
      timeout: constants.coordinator.TIMEOUT,
      role: constants.coordinator.ROLE
    }
  };
};

/**
 * It is sometimes helpful to have a component definition for the invoker.
 *
 * @return {Object} A component definition.
 */
exports.getInvokerComponentDefinition = function () {
  return {
    name: constants.invoker.NAME,
    type: constants.componentType.INTERNAL,
    lambda: {
      // It uses a different handle in the coordinator package.
      npmPackage: path.resolve(
        __dirname,
        '../lambdaFunctions/coordinator'
      ),
      handler: constants.invoker.HANDLE,
      memorySize: constants.invoker.MEMORY_SIZE,
      timeout: constants.invoker.TIMEOUT,
      role: constants.invoker.ROLE
    }
  };
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
