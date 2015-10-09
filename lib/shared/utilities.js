/**
 * @fileOverview Utilities shared between deploy code and Lambda functions.
 *
 * Since this will be used in deployed functions, it cannot require any non-core
 * modules other than aws-sdk - there is no guarantee they will be there.
 */

// Core.
var path = require('path');
var util = require('util');

// AWS SDK is provided to all Lambda functions.
var AWS = require('aws-sdk');

// ---------------------------------------------------------------------------
// Properties.
// ---------------------------------------------------------------------------

// AWS SDK clients are created to use default credentials and configuration
// obtained from the standard credentials file, environment variables, or
// instance metadata.
exports.lambdaClient = new AWS.Lambda();
exports.s3Client = new AWS.S3();
exports.sqsClient = new AWS.SQS();

exports.retryLimit = 3;

// ---------------------------------------------------------------------------
// Low level utilities.
// ---------------------------------------------------------------------------

// Sad that we have to write these, but we can't guarantee the presence of any
// particular helper package or version thereof in a Lambda function.

/**
 * Is this item an array?
 *
 * @param {Mixed} arr Possibly an array.
 * @return {Boolean} True is the provided value is an array.
 */
exports.isArray = function (arr) {
  return Object.prototype.toString.call(arr) === '[object Array]';
};

/**
 * Capitalize this string.
 *
 * @param {String} str A string.
 * @return {String} Capitalized string.
 */
exports.capitalize = function (str) {
  if (!str || typeof str !== 'string') {
    return str;
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
};

// ---------------------------------------------------------------------------
// Async flow control functions.
// ---------------------------------------------------------------------------

// Sad that we have to write these, but we can't guarantee the presence of any
// particular helper package or version thereof in a Lambda function.

/**
 * Retry an asynchronous function.
 *
 * @param {Function} fn Of the form function (callback).
 * @param {Number} limit Number of times to retry before failing.
 * @param {String} retryErrorMessage Message to log on failure and retry.
 * @param {Function} callback Of the form function (error).
 */
exports.retry = function (fn, retryErrorMessage, callback) {
  var attempts = 0;

  function runFn () {
    attempts++;

    fn(function (error) {
      if (error) {
        if (attempts >= exports.retryLimit) {
          return callback.apply(this, arguments);
        }
        else {
          console.error(retryErrorMessage, error);
          return runFn();
        }
      }

      callback.apply(this, arguments);
    });
  }

  runFn();
};

/**
 * Run an asynchronous function on each item in an array in parallel.
 *
 * @param {Array} dataArray Array of items to pass to the function.
 * @param {Function} fn Of the form fn (data, callback).
 * @param {Function} callback Of the form function (error).
 */
exports.each = function (dataArray, fn, callback) {
  var completed = 0;
  var calledBack = false;
  var length = dataArray.length;

  function innerCallback (error) {
    if (calledBack) {
      return;
    }

    completed++;

    if (error) {
      calledBack = true;
      callback(error);
    }
    else if (completed === length) {
      calledBack = true;
      callback();
    }
  }

  for (var index = 0; index < length; index++) {
    fn(dataArray[index], innerCallback);
  }
};

// ---------------------------------------------------------------------------
// Conversion between config names and deployed names.
// ---------------------------------------------------------------------------

/**
 * Roles are deployed with names derived from the name provided in the
 * configuration.
 *
 * @param {String} name Name of a role.
 * @param {Object} config The application configuration.
 * @return {String} The full name.
 */
exports.getRoleName = function (name) {
  return exports.capitalize(name) + 'Role';
};

/**
 * Queues are deployed with names derived from the component name provided in
 * the configuration.
 *
 * @param {String} name Name of a component.
 * @param {Object} config The application configuration.
 * @return {String} The name.
 */
exports.getQueueName = function (name) {
  return exports.capitalize(name) + 'Queue';
};

/**
 * Queues are deployed with names derived from the component name provided in
 * the configuration.
 *
 * Unlike other resource types, the full queue name runs through the
 * CloudFormation process without getting prefixed, so add the needed uniqueness
 * prefixes here.
 *
 * @param {String} name Name of a component.
 * @param {Object} config The application configuration.
 * @return {String} The full name.
 */
exports.getFullQueueName = function (name, config) {
  return config.name + '-' + config.deployId + '-' + exports.getQueueName(name);
};

/**
 * Queues are deployed with names derived from the component name provided in
 * the configuration.
 *
 * @param {String} name Name of a component.
 * @param {Object} config The application configuration.
 * @return {String} The name.
 */
exports.getConcurrencyQueueName = function (name) {
  return exports.capitalize(name) + 'ConcurrencyQueue';
};

/**
 * Queues are deployed with names derived from the component name provided in
 * the configuration.
 *
 * Unlike other resource types, the full queue name runs through the
 * CloudFormation process without getting prefixed, so add the needed uniqueness
 * prefixes here.
 *
 * @param {String} name Name of a component.
 * @param {Object} config The application configuration.
 * @return {String} The full name.
 */
exports.getFullConcurrencyQueueName = function (name, config) {
  return config.name + '-' +
    config.deployId + '-' +
    exports.getConcurrencyQueueName(name);
};

/**
 * Lambda functions are deployed with names derived from those provided in the
 * configuration.
 *
 * @param {String} name Name of a component.
 * @param {Object} config The application configuration.
 * @return {String} The full name.
 */
exports.getLambdaFunctionName = function (name) {
  return exports.capitalize(name);
};

// --------------------------------------------------------------------------
// Tools relating to the ARN map.
// --------------------------------------------------------------------------

// The ARN map is simply the Outputs from the CloudFormation template. So its
// format is:
//
// {
//   "arnOutputName": {
//     Description: '',
//     Value: 'the arn'
//   },
//   ...
// }

/**
 * Obtain the name for the queue ARN output.
 *
 * @param {String} name Name of a component.
 * @param {Object} config The application configuration.
 * @return {String} The full name.
 */
exports.getQueueArnOutputName = function (name) {
  return exports.getQueueName(name) + 'Arn';
};

/**
 * Obtain the name for the concurrency queue ARN output.
 *
 * @param {String} name Name of a component.
 * @param {Object} config The application configuration.
 * @return {String} The full name.
 */
exports.getConcurrencyQueueArnOutputName = function (name) {
  return exports.getConcurrencyQueueName(name) + 'Arn';
};

/**
 * Obtain the name for the Lambda function ARN output.
 *
 * @param {String} name Name of a component.
 * @param {Object} config The application configuration.
 * @return {String} The full name.
 */
exports.getLambdaFunctionArnOutputName = function (name) {
  return exports.getLambdaFunctionName(name) + 'Arn';
};

/**
 * Obtain the ARN for a queue.
 *
 * @param {String} name Name of a component.
 * @param {Object} arnMap The ARN map for a deployed application.
 * @return {String} The queue ARN.
 */
exports.getQueueArn = function (name, arnMap) {
  return arnMap[exports.getQueueArnOutputName(name)];
};

/**
 * Obtain the ARN for a queue.
 *
 * @param {String} name Name of a component.
 * @param {Object} arnMap The ARN map for a deployed application.
 * @return {String} The queue ARN.
 */
exports.getConcurrencyQueueArn = function (name, arnMap) {
  return arnMap[exports.getConcurrencyQueueArnOutputName(name)];
};

/**
 * Given an SQS ARN, convert it to an SQS URL.
 *
 * @param {String} arn The ARN.
 * @return {String} The URL.
 */
exports.sqsUrlFromArn = function (arn) {
  if (!arn) {
    return undefined;
  }

  // Should be: 'arn:aws:sqs:us-east-1:444555666777:queuename' or similar.
  arn = arn.split(':');

  var region = arn[3];
  var accountId = arn[4];
  var queueName = arn[5];

  return util.format(
    'https://sqs.%s.amazonaws.com/%s/%s',
    region,
    accountId,
    queueName
  );
}

/**
 * Given the name for a message from queue type component from configuration,
 * get the full queue URL.
 *
 * @param {String} name Name of a component.
 * @param {Object} arnMap The ARN map for a deployed application.
 * @return {String} The full queue URL, suitable for use with the API.
 */
exports.getQueueUrl = function (name, arnMap) {
  return exports.sqsUrlFromArn(
    exports.getQueueArn(name, arnMap)
  );
};

/**
 * Given a component name from configuration, get the full concurrency queue
 * URL.
 *
 * @param {String} name Name of a component.
 * @param {Object} arnMap The ARN map for a deployed application.
 * @return {String} The full queue URL, suitable for use with the API.
 */
exports.getConcurrencyQueueUrl = function (name, arnMap) {
  return exports.sqsUrlFromArn(
    exports.getConcurrencyQueueArn(name, arnMap)
  );
};

/**
 * Obtain the ARN for a Lambda function.
 *
 * @param {String} name Name of a component.
 * @param {Object} arnMap The ARN map for a deployed application.
 * @return {String} The queue ARN.
 */
exports.getLambdaFunctionArn = function (name, arnMap) {
  return arnMap[exports.getLambdaFunctionArnOutputName(name)];
};

// --------------------------------------------------------------------------
// Tools relating to the handle.
// --------------------------------------------------------------------------

/**
 * Given a handle of 'index.handler', return 'index'.
 *
 * Note that in theory the file name could have periods, but the function name
 * will not.
 *
 * @param {String} handle A Lambda function handle.
 * @return {String} The file base name.
 */
exports.getFileBaseNameFromHandle = function (handle) {
  return handle.replace(/\.[^\.]+$/, '');
};

/**
 * Given a handle of 'index.handler', return 'handle'.
 *
 * Note that in theory the file name could have periods, but the function name
 * will not.
 *
 * @param {String} handle A Lambda function handle.
 * @return {String} The file base name.
 */
exports.getFunctionNameFromHandle = function (handle) {
  return handle.split(/\./).pop();
};

// ---------------------------------------------------------------------------
// AWS API Lambda functions.
// ---------------------------------------------------------------------------

/**
 * Invoke a Lambda function instance.
 *
 * @param {String} arn A Lambda function ARN.
 * @param {Mixed} payload Data to be passed to the invoked lambda function.
 * @param {Function} callback Of the form function (error).
 */
exports.invoke = function (arn, payload, callback) {
  var params = {
    FunctionName: arn,
    // 'Event' means asynchronous execution, so the API request will return
    // immediately.
    InvocationType: 'Event',
    // LogType must be "None" for asynchronous execution.
    LogType: 'None',
    Payload: JSON.stringify(payload)
  };

  exports.retry(
    function (retryCallback) {
      exports.lambdaClient.invoke(params, retryCallback);
    },
    util.format('Error invoking destination function %s, retrying.', arn),
    callback
  );
};

// ---------------------------------------------------------------------------
// AWS API SQS functions.
// ---------------------------------------------------------------------------

/**
 * Send a message to a queue.
 *
 * @param {String} queueUrl The queue URL.
 * @param {Mixed} payload Data to be passed to the invoked lambda function.
 * @param {Function} callback Of the form function (error).
 */
exports.sendMessage = function (queueUrl, payload, callback) {
  var params = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload)
  };

  exports.retry(
    function (retryCallback) {
      exports.sqsClient.sendMessage(params, retryCallback);
    },
    util.format('Error sending to queue %s, retrying.', params.queueUrl),
    callback
  );
};

/**
 * Delete a message from a queue. This must be done on completion of
 * successful processing.
 *
 * @param {String} queueUrl The queue URL.
 * @param {String} receiptHandle The unique receipt handle provided when the
 *   message was received.
 * @param {Function} callback Of the form function (error).
 */
exports.deleteMessage = function (queueUrl, receiptHandle, callback) {
  var params = {
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle
  };

  // Don't retry this. If the deletion fails it will be processed again.
  exports.sqsClient.deleteMessage(params, callback);
};

/**
 * Receive a single message from the queue.
 *
 * The response is of the form:
 *
 * {
 *   message: 'json string',
 *   receiptHandle: receiptHandleObj
 * }
 *
 * If there is no message, the message object is undefined.
 *
 * @param {String} queueUrl The queue URL.
 * @param {String} visibilityTimeout How long to wait before making the message
 *   visible again. This should be the same as the Lambda function timeout for
 *   the associated component.
 * @param {Number} waitTime How long to wait for a message, in seconds.
 * @param {Function} callback Of the form function (error, message).
 */
exports.receiveMessage = function (queueUrl, visibilityTimeout, waitTime, callback) {
  var params = {
    QueueUrl: queueUrl,
    // Only retrieve one message.
    MaxNumberOfMessages: 1,
    // The same as the maximum life span of the related component Lambda
    // function; release a message back to another processor after this timeout.
    VisibilityTimeout: visibilityTimeout,
    // How long to wait for a message to turn up.
    WaitTimeSeconds: waitTime
  };

  exports.sqsClient.receiveMessage(params, function (error, result) {
    if (error) {
      return callback(error);
    }

    // If nothing was returned.
    if (!result || !result.Messages || !result.Messages.length) {
      return callback();
    }

    callback(undefined, {
      message: result.Messages[0].Body,
      receiptHandle: result.Messages[0].ReceiptHandle
    });
  });
};

/**
 * Obtain attributes for the named queue.
 *
 * @param {String} queueUrl The queue URL.
 * @param {Function} callback Of the form function (error, attributes).
 */
exports.getQueueAttributes = function (queueUrl, callback) {
  var params = {
    QueueUrl: queueUrl,
    AttributeNames: [
      'ApproximateNumberOfMessages'
    ]
  };

  // Retry since it is fairly pivotal to the operation of the coordinator.
  exports.retry(
    function (retryCallback) {
      exports.sqsClient.getQueueAttributes(params, retryCallback);
    },
    util.format(
      'Error obtaining queue attributes from %s, retrying.',
      params.QueueUrl
    ),
    function (error, result) {
      if (error) {
        return callback(error);
      }

      callback(undefined, result.Attributes);
    }
  );
};

// ---------------------------------------------------------------------------
// AWS S3 Functions.
// ---------------------------------------------------------------------------

/**
 * Return the full prefix for S3 files relating to this application.
 *
 * @param {Object} config Configuration object.
 * @return {String} The prefix.
 */
exports.getFullS3KeyPrefix = function (config) {
  return path.join(
    config.deployment.s3KeyPrefix,
    config.name,
    // This could be a number or a string, but path#join requires strings.
    '' + config.deployId
  );
};

/**
 * Return the ARN map key for this application.
 *
 * @param {Object} config Configuration object.
 * @return {String} The key.
 */
exports.getArnMapS3Key = function (config) {
  return path.join(
    exports.getFullS3KeyPrefix(config),
    'arnMap.json'
  );
};

/**
 * Load the map of ARNs by component for this application.
 *
 * @param {Object} config Configuration object.
 * @return {Function} callback Of the form function (error, arnMap).
 */
exports.loadArnMap = function (config, callback) {
  var params = {
    Bucket: config.deployment.s3Bucket,
    Key: exports.getArnMapS3Key(config)
  };

  // S3 operations are flaky enough to always need a retry.
  exports.retry(
    function (retryCallback) {
      exports.s3Client.getObject(params, retryCallback);
    },
    util.format(
      'Error loading ARN map at %s, retrying.',
      params.Key
    ),
    function (error, result) {
      if (error) {
        return callback(error);
      }

      var arnMap;

      try {
        // Should be a string, might be a Buffer.
        arnMap = JSON.parse(result.Body.toString('utf8'));
      }
      catch (e) {
        return callback(new Error(util.format(
          'Failed to parse ARN map JSON. %s',
          e.stack || e.message
        )));
      }

      callback(null, arnMap);
    }
  );
};
