/**
 * @fileOverview Packaging and uploading Lambda function NPM modules.
 *
 * This handles:
 *
 * - Zipping Lambda function modules.
 * - Uploading zipfiles to S3.
 */

// Core.
var os = require('os');
var path = require('path');

// NPM.
var archiver = require('archiver');
var async = require('async');
var fs = require('fs-extra');
var _ = require('lodash');

// Local.
var common = require('./common');

// ---------------------------------------------------------------------------
// Variables.
// ---------------------------------------------------------------------------

// Assuming the setting of credentials via environment variable, credentials
// file, role, etc.
var cpuCount = os.cpus().length;

// ---------------------------------------------------------------------------
// Functions.
// ---------------------------------------------------------------------------

/**
 * Bundle an installed Lambda function NPM module into a zip file.
 *
 * @param {Object} component Component definition.
 * @param {Object} config The application config.
 * @param {Function} callback Of the form function (error).
 */
function packageLambdaFunction (component, config, callback) {
  var zipper = archiver('zip', {});
  var distDir = common.getApplicationBuildDirectory(config);
  var output = fs.createWriteStream(common.getComponentZipFilePath(
    component,
    config
  ));

  callback = _.once(callback);
  zipper.pipe(output);

  zipper.on('error', callback);
  output.on('close', callback);

  zipper.bulk([
    {
      cwd: path.join(distDir, component.name),
      // Make the glob matcher see dotfiles.
      dot: true,
      expand: true,
      // Archive everything in the installed NPM module.
      src: ['**']
    }
  ]).finalize();
}

// ---------------------------------------------------------------------------
// Exported functions.
// ---------------------------------------------------------------------------

/**
 * Zip up the installed Lambda function NPM modules.
 *
 * @param {Object} config The application config.
 * @param {Function} callback Of the form function (error).
 */
exports.packageLambdaFunctions = function (config, callback) {
  var components = common.getAllComponents(config);

  // Concurrently package modules.
  var queue = async.queue(function (component, asyncCallback) {
    packageLambdaFunction(
      component,
      config,
      asyncCallback
    );
  }, cpuCount);

  queue.drain = _.once(callback);

  function onTaskCompletion (error) {
    if (error) {
      queue.kill();
      callback(error);
    }
  }

  _.each(components, function (component) {
    queue.push(component, onTaskCompletion);
  });
};
