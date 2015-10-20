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

// Sad that these have to exist, but we can't guarantee the presence of any
// particular helper package or version thereof in a Lambda function.

/**
 * Retry an asynchronous function.
 *
 * @param {Function} fn Of the form function (callback).
 * @param {String} retryErrorMessage Message to log on failure and retry.
 * @param {Function} callback Callback, arguments from the retried callback are
 *   passed through.
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

/**
 * Run a set of asyncronous functions in series. Each function must have the
 * form function (seriesCallback).
 *
 * On an error break out of the series and call back without invoking the
 * remaining functions.
 *
 * @param {Function[]} fns Array of functions of the form function (callback).
 * @param {Function} callback Of the form function (error).
 */
exports.series = function (fns, callback) {
  if (!exports.isArray(fns)) {
    return callback(new Error(
      'The series function requires an array of functions'
    ));
  }

  fns = fns.slice(0);

  function invokeNext () {
    var fn = fns.shift();

    // Are we done?
    if (fn ===  undefined) {
      return callback();
    }

    fn(function (error) {
      if (error) {
        return callback(error);
      }

      invokeNext();
    });
  };

  invokeNext();
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

/**
 * Obtain the number of visible messages in the queue.
 *
 * @param {String} queueUrl The queue URL.
 * @param {Function} callback Of the form function (error, count).
 */
exports.getQueueMessageCount = function (queueUrl, callback) {
  exports.getQueueAttributes(queueUrl, function (error, attributes) {
    if (error) {
      return callback(error);
    }

    // The attribute comes back as a string integer representation, so parse it
    // on the way past.
    callback(undefined, parseInt(attributes.ApproximateNumberOfMessages, 10));
  });
};

// ---------------------------------------------------------------------------
// Concurrency Tracking, currently SQS-based.
// ---------------------------------------------------------------------------

// The standard issue metrics available for Lambda functions via CloudWatch
// don't do concurrency, just invocation counts per unit time. An acceptable
// stand-in is the use of SQS queues: add a message when starting a function,
// then delete one when finishing. There is still a limitation here in that
// the minimum expiration time on messages is 60 seconds, so in the case where
// decrementing fails you have an incorrectly high number of messages.
//
// This is borderline acceptable, given that most errors can be intercepted
// and the necessary clean up activities undertaken, including decrementing
// the concurrency count.
//
// There are numerous other ways to run a concurrency count within AWS, such as
// by using ElastiCache Redis, or S3 files, but SQS queues seems to be the most
// cost-effective and easiest to hook into monitoring.

/**
 * Increment the concurrency tracking for this component.
 *
 * @param {String} component Component definition.
 * @param {String} arnMap The ARN map.
 * @param {Function} callback Of the form function (error).
 */
exports.incrementConcurrencyCount = function (component, arnMap, callback) {
  // The actual contents of the message sent don't matter.
  var payload = {};

  // Important enough to wrap in a retry. Failure is annoying.
  exports.retry(
    function (retryCallback) {
      exports.sendMessage(
        exports.getConcurrencyQueueUrl(component.name, arnMap),
        payload,
        retryCallback
      );
    },
    util.format(
      'Increment concurrency failed for %s. Retrying.',
      component.name
    ),
    callback
  );
};

/**
 * Decrement the concurrency tracking for this component.
 *
 * @param {String} component Component definition.
 * @param {String} arnMap The ARN map.
 * @param {Function} callback Of the form function (error).
 */
exports.decrementConcurrencyCount = function (component, arnMap, callback) {
  var queueUrl = exports.getConcurrencyQueueUrl(component.name, arnMap);
  // This has to be some number large enough to cover the length of time taken
  // to receive and then delete the message. If it were too low (e.g. 0) then
  // deleteMessage would fail intermittently, but still return success codes.
  var visibilityTimeout = component.lambda.timeout;
  var failureMessage = util.format(
    'Decrement concurrency failed for %s. Retrying.',
    component.name
  );

  // Important enough to wrap the pieces in retry flows. Failure is annoying.
  exports.retry(
    function (retryCallback) {
      exports.receiveMessage(
        queueUrl,
        visibilityTimeout,
        component.queueWaitTime,
        retryCallback
      );
    },
    failureMessage,
    function (error, result) {
      if (error) {
        return callback(error);
      }

      // No message? This is probably some sort of error, but if you are poking
      // around in the SQS interface and polling queues for messages that will
      // tend to make messages unavailable for decrement.
      if (!result) {
        return callback(new Error(
          'No visible concurrency queue message to delete.'
        ));
      }

      exports.retry(
        function (retryCallback) {
          exports.deleteMessage(queueUrl, result.receiptHandle, retryCallback);
        },
        failureMessage,
        callback
      );
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
 * Return the key for the configuration file reference for this deployment.
 *
 * This is not used by the application when running, but is helpful to have as
 * a reference or for tooling purposes.
 *
 * @param {Object} config Configuration object.
 * @return {String} The key.
 */
exports.getConfigS3Key = function (config) {
  return path.join(
    exports.getFullS3KeyPrefix(config),
    'config.js'
  );
};

/**
 * Return the key for the file stored to confirm that a deployed application is
 * running.
 *
 * @param {Object} config Configuration object.
 * @return {String} The key.
 */
exports.getApplicationConfirmationS3Key = function (config) {
  return path.join(
    exports.getFullS3KeyPrefix(config),
    'confirm.txt'
  );
};

/**
 * Upload the application confirmation file, which should be created by the
 * first run of the coordinators as a way to confirm that things are working.
 *
 * @param {Object} config Configuration object.
 * @return {Function} callback Of the form function (error, boolean).
 */
exports.uploadApplicationConfirmation = function (config, callback) {
  // TODO: ACL options; what will be needed here for additional customization?
  var params = {
    Body: 'confirm',
    Bucket: config.deployment.s3Bucket,
    // Not strictly necessary, but helpful for human inspection.
    ContentType: 'text/plain',
    Key: exports.getApplicationConfirmationS3Key(config)
  };

  // S3 operations are flaky enough to always need a retry.
  exports.retry(
    function (retryCallback) {
      exports.s3Client.putObject(params, retryCallback);
    },
    util.format(
      'Error uploading application confirmation file at %s, retrying.',
      params.Key
    ),
    callback
  );
};

/**
 * Check on the existence of the application confirmation file, created by the
 * first run of the coordinators.
 *
 * @param {Object} config Configuration object.
 * @return {Function} callback Of the form function (error, boolean).
 */
exports.applicationConfirmationExists = function (config, callback) {
  var params = {
    Bucket: config.deployment.s3Bucket,
    Key: exports.getApplicationConfirmationS3Key(config)
  };

  // S3 operations are flaky enough to always need a retry.
  exports.retry(
    function (retryCallback) {
      exports.s3Client.getObject(params, function (error, results) {
        // If this is a 404 error, then skip the retries; we found out what we
        // needed to know and the file isn't there yet.
        if (error && error.statusCode === 404) {
          return callback(null, false);
        }

        retryCallback(error, results);
      });
    },
    util.format(
      'Error loading application confirmation file at %s, retrying.',
      params.Key
    ),
    function (error, result) {
      // Some persistent error other than a 404.
      if (error) {
        return callback(error, false);
      }

      callback(null, true);
    }
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
