/**
 * @fileOverview For the initial install of Lambda function NPM packages.
 *
 * This handles:
 *
 * - NPM installation.
 * - Copying modules to sensible places.
 * - Wrapping the handler function in Lambda Complex code.
 */

// Core.
var childProcess = require('child_process');
var path = require('path');
var util = require('util');

// NPM.
var async = require('async');
var fs = require('fs-extra');
var handlebars = require('handlebars');
var _ = require('lodash');

// Local.
var common = require('./common');
var constants = require('../shared/constants');
var utilities = require('../shared/utilities');

// ---------------------------------------------------------------------------
// Functions exported only for testability.
// ---------------------------------------------------------------------------

/**
 * For the Lambda function package in the provided directory, identify the file
 * exporting the handle function, then:
 *
 * - move filename.js to _filename.js
 * - create a new filename.js with a wrapper handler function.
 *
 * @param {Object} component Component definition.
 * @param {Object} config The application configuration.
 * @param {Function} wrapperTemplate Template function for the wrapper script.
 * @param {Function} callback Of the form function (error).
 */
exports.wrapHandlerForInstalledLambdaFunction = function (
  component,
  config,
  wrapperTemplate,
  callback
) {
  // Figure out the file to wrap from the handle.
  var fileBaseName = utilities.getFileBaseNameFromHandle(
    component.lambda.handler
  );
  var packageDir = path.join(
    common.getApplicationBuildDirectory(config),
    component.name
  );
  var sourcePath = path.join(packageDir, fileBaseName + '.js');
  var destinationPath = path.join(packageDir, '_' + fileBaseName + '.js');

  async.series({
    move: function (asyncCallback) {
      fs.move(sourcePath, destinationPath, asyncCallback);
    },
    write: function (asyncCallback) {
      var contents = wrapperTemplate({
        componentName: component.name
      });

      fs.writeFile(sourcePath, contents, {
        encoding: 'utf-8'
      }, asyncCallback);
    }
  }, callback);
};

/**
 * Obtain the handlebars template function for the wrapper to replace the
 * handle file.
 *
 * @param {Function} callback Of the form function (error, templateFn).
 */
exports.getWrapperTemplate = function (callback) {
  var templateFilePath = path.join(__dirname, 'template/index.js.hbs');
  fs.readFile(templateFilePath, {
    encoding: 'utf8'
  }, function (error, contents) {
    if (error) {
      return callback(error);
    }

    callback(null, handlebars.compile(contents));
  });
};

/**
 * Run npm install for a Lambda function package to install it to the
 * application build directory.
 *
 * @param {Object} config The application configuration.
 * @param {String} npmPackage A package name or a path to a package.
 * @param {Function} callback Of the form function (error).
 */
exports.npmInstallLambdaFunction = function (config, npmPackage, callback) {
  childProcess.exec(
    util.format('npm install %s', npmPackage),
    {
      // Always a good idea to pass over the whole environment.
      env: process.env,
      cwd: common.getApplicationBuildDirectory(config),
      encoding: 'utf-8'
    },
    callback
  );
};

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

/**
 * Run the necessary steps to install the Lambda function for a component.
 *
 * @param {Object} component Component definition from configuration.
 * @param {Object} config The application configuration.
 * @param {Function} wrapperTemplate Handlebars template.
 * @param {Function} callback Of the form function (error).
 */
exports.installLambdaFunction = function (
  component,
  config,
  wrapperTemplate,
  callback
) {
  // Configuration file contents.
  var configContents = exports.generateConfigContents(config);
  // We figure out where the NPM installation landed by listing directories
  // before and after. It is otherwise hard to say what a string that may be a
  // package name or directory will produce via npm install.
  var installDirsBefore;
  var installDirsAfter;
  // Where it is initially installed.
  var installDir;
  // Where it will be moved to after installation.
  var destinationDir;


  async.series({
    listDirsBefore: function (asyncCallback) {
      common.getApplicationPackageDirectories(config, function (error, dirs) {
        installDirsBefore = dirs;
        asyncCallback(error);
      });
    },
    npmInstall: function (asyncCallback) {
      exports.npmInstallLambdaFunction(
        config,
        component.lambda.npmPackage,
        asyncCallback
      );
    },
    listDirsAfter: function (asyncCallback) {
      common.getApplicationPackageDirectories(config, function (error, dirs) {
        if (error) {
          return asyncCallback(error);
        }

        installDirsAfter = dirs;
        installDir = _.difference(installDirsAfter, installDirsBefore)[0];
        asyncCallback();
      });
    },
    // Since two or more components can use the same NPM package, but will need
    // different wrapper templates applied to them, we move the installed
    // package to a different directory.
    moveInstall: function (asyncCallback) {
      destinationDir = path.join(
        common.getApplicationBuildDirectory(config),
        component.name
      );
      fs.move(installDir, destinationDir, asyncCallback);
    },
    // Write a copy of the configuration to _config.js in the installed package.
    copyConfig: function (asyncCallback) {
      fs.writeFile(path.join(destinationDir, '_config.js'), configContents, {
        encoding: 'utf-8'
      }, asyncCallback);
    },
    // Write a copy of the constants file to _constants.js in the installed
    // package.
    copySharedConstants: function (asyncCallback) {
      fs.copy(
        path.join(__dirname, '../shared/constants.js'),
        path.join(destinationDir, '_constants.js'),
        asyncCallback
      );
    },
    // Write a copy of the utilities file to _utilities.js in the installed
    // package.
    copySharedUtilities: function (asyncCallback) {
      fs.copy(
        path.join(__dirname, '../shared/utilities.js'),
        path.join(destinationDir, '_utilities.js'),
        asyncCallback
      );
    },
    // Move the Lambda function handle Javascript file and replace it with a
    // wrapper.
    wrapHandleFile: function (asyncCallback) {
      // We don't do the wrapping for internal components such as the
      // coordinator.
      if (component.type === constants.componentType.INTERNAL) {
        return asyncCallback();
      }

      exports.wrapHandlerForInstalledLambdaFunction(
        component,
        config,
        wrapperTemplate,
        asyncCallback
      );
    }
  }, callback);
};

// ---------------------------------------------------------------------------
// Exported functions (public interface).
// ---------------------------------------------------------------------------

/**
 * Run npm install for all of the specified lambda function packages.
 *
 * TODO: this won't work for native packages unless this is run on the right
 * version of Amazon Linux as the packages have to be built against the right
 * Amazon binaries to work in Lambda. See:
 * https://aws.amazon.com/blogs/compute/nodejs-packages-in-lambda/
 *
 * @param {Object} config The configuration for this deployment.
 * @param {Function} callback Of the form function (error).
 */
exports.installLambdaFunctions = function (config, callback) {
  var nodeModulesDir = common.getApplicationBuildNodeModulesDirectory(config);
  var components = common.getAllComponents(config);
  var wrapperTemplate;

  async.series({
    ensureDirectory: function (asyncCallback) {
      fs.mkdirs(nodeModulesDir, asyncCallback);
    },
    loadWrapperTemplate: function (asyncCallback) {
      exports.getWrapperTemplate(function (error, template) {
        wrapperTemplate = template;
        asyncCallback(error);
      });
    },
    installLambdaFunctions: function (asyncCallback) {
      // This has to run in series because we figure out what was installed and
      // where by checking directories before and after. This is the easiest
      // way to understand what npm install actually did with the string you
      // gave it.
      //
      // Also NPM can be cranky about running in parallel.
      async.eachSeries(components, function (component, innerAsyncCallback) {
        exports.installLambdaFunction(
          component,
          config,
          wrapperTemplate,
          innerAsyncCallback
        );
      }, asyncCallback);
    },
    // Get rid of the node_modules directory left over after installations. It
    // should be empty.
    removeNodeModules: function (asyncCallback) {
      fs.rmdir(
        common.getApplicationBuildNodeModulesDirectory(config),
        asyncCallback
      );
    }
  }, callback);
};
