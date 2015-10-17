/**
 * @fileOverview S3 related utilities.
 */

// Core.
var os = require('os');

// NPM.
var AWS = require('aws-sdk');
var async = require('async');
var fs = require('fs-extra');
var _ = require('lodash');

// Local.
var common = require('../build/common');
var utilities = require('../shared/utilities');

// ---------------------------------------------------------------------------
// Variables.
// ---------------------------------------------------------------------------

// Assuming the setting of credentials via environment variable, credentials
// file, role, etc.
//
// This is exported for test purposes.
exports.s3Client = new AWS.S3();

var cpuCount = os.cpus().length;

// ---------------------------------------------------------------------------
// Exported functions.
// ---------------------------------------------------------------------------

/**
 * Upload the map of ARNs for the application as JSON.
 *
 * @param {Object} map The map of ARNs.
 * @param {Object} config The application config.
 * @param {Function} callback Of the form function (error).
 */
exports.uploadArnMap = function (map, config, callback) {
  // TODO: ACL options; what will be needed here for additional customization?
  var params = {
    Body: JSON.stringify(map),
    Bucket: config.deployment.s3Bucket,
    // Not strictly necessary, but helpful for human inspection.
    ContentType: 'application/json',
    Key: utilities.getArnMapS3Key(config)
  };

  // S3 uploads are flaky enough to always need a retry.
  async.retry(3, function (asyncCallback) {
    exports.s3Client.putObject(params, asyncCallback);
  }, callback);
};

/**
 * Upload the configuration file to S3, alongside the other items relating to
 * this deployment.
 *
 * This will be useful for later tooling and manual reference, but is not used
 * by the running Lambda Complex application.
 *
 * @param {Object} config The application config.
 * @param {Function} callback Of the form function (error).
 */
exports.uploadConfig = function (config, callback) {
  // TODO: ACL options; what will be needed here for additional customization?
  var params = {
    Body: common.generateConfigContents(config),
    Bucket: config.deployment.s3Bucket,
    // Not strictly necessary, but helpful for human inspection.
    ContentType: 'application/javascript',
    Key: utilities.getConfigS3Key(config)
  };

  // S3 uploads are flaky enough to always need a retry.
  async.retry(3, function (asyncCallback) {
    exports.s3Client.putObject(params, asyncCallback);
  }, callback);
};

/**
 * Upload a zipped Lambda function NPM module to S3.
 *
 * The uploaded zip file will later be referenced in a CloudFormation template.
 *
 * @param {Object} component Component definition.
 * @param {Object} config The application config.
 * @param {Function} callback Of the form function (error).
 */
exports.uploadLambdaFunction = function (component, config, callback) {
  var params;

  // S3 uploads are flaky enough to always need a retry.
  async.retry(3, function (asyncCallback) {
    // Since we're using a stream, recreate the params each time we retry.
    //
    // TODO: ACL options; what will be needed here for additional customization?
    params = {
      Body: fs.createReadStream(common.getComponentZipFilePath(
        component,
        config
      )),
      Bucket: config.deployment.s3Bucket,
      Key: common.getComponentS3Key(component, config)
    };

    exports.s3Client.putObject(params, asyncCallback);
  }, callback);
}

/**
 * Upload the Lambda function zip files to S3.
 *
 * @param {Object} config The application config.
 * @param {Function} callback Of the form function (error).
 */
exports.uploadLambdaFunctions = function (config, callback) {
  var components = common.getAllComponents(config);

  // Concurrently package modules.
  var queue = async.queue(function (component, asyncCallback) {
    exports.uploadLambdaFunction(
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
