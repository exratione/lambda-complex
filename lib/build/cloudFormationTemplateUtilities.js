/**
 * @fileOverview CloudFormation template construction utilities.
 */

// Core.
var util = require('util');

// NPM.
var fs = require('fs-extra');
var _ = require('lodash');

// Local.
var common = require('../build/common');
var constants = require('../shared/constants');
var utilities = require('../shared/utilities');

// ---------------------------------------------------------------------------
// Functions exported for unit test purposes.
// ---------------------------------------------------------------------------

/**
 * Return an array of all role definitions, including internal ones.
 *
 * @param {Object} config Configuration object.
 * @return {Object[]} Component definitions.
 */
exports.getAllRoles = function (config) {
  return [
    // The internal role, not specified in config.
    {
      name: constants.coordinator.ROLE,
      // No custom statements. The standard set of default statements added
      // in CloudFormation template construction are all that is needed.
      statements: []
    }
  ].concat(config.roles);
};

// ---------------------------------------------------------------------------
// Functions.
// ---------------------------------------------------------------------------

/**
 * Every role is given an additional policy allowing read/write access to the
 * queues that are a part of the application.
 *
 * @param {Object} config The application configuration.
 * @return {Object} The statement.
 */
function getQueuesStatement (config) {
  return {
    Effect: 'Allow',
    Action: [
      'sqs:DeleteMessage',
      'sqs:GetQueueAttributes',
      'sqs:ReceiveMessage',
      'sqs:SendMessage'
    ],
    Resource: _.map(
      common.getEventFromMessageComponents(config),
      function (component) {
        return {
          'Fn::GetAtt': [
            utilities.getQueueName(component.name),
            'Arn'
          ]
        };
      }
    )
  };
}

/**
 * Every role is given an additional policy allowing read/write access to the
 * concurrency queues that are a part of the application.
 *
 * @param {Object} config The application configuration.
 * @return {Object} The statement.
 */
function getConcurrencyQueuesStatement (config) {
  return {
    Effect: 'Allow',
    Action: [
      'sqs:DeleteMessage',
      'sqs:GetQueueAttributes',
      'sqs:ReceiveMessage',
      'sqs:SendMessage'
    ],
    Resource: _.map(
      common.getAllComponents(config),
      function (component) {
        return {
          'Fn::GetAtt': [
            utilities.getConcurrencyQueueName(component.name),
            'Arn'
          ]
        };
      }
    )
  };
}

/**
 * Every role is given an additional policy allowing permissions relating to the
 * Lambda functions that are a part of the application.
 *
 * @param {Object} config The application configuration.
 * @return {Object} The statement.
 */
function getLambdaFunctionsStatement (config) {
  return {
    Effect: 'Allow',
    Action: [
      'lambda:InvokeFunction'
    ],
    // We can't use the actual Lambda function ARNs via Fn::GetAtt as that
    // would create circular references. So make use of the fact that all of the
    // ARNs will be prefixed by the application name, and use wildcards.
    Resource: [
      util.format(
        // The first wildcard is the account ID, which we also don't know at this
        // point.
        'arn:aws:lambda:%s:*:function:%s-*',
        config.deployment.region,
        config.name
      )
    ]
  };
}

/**
 * Every role is given an additional policy allowing Lambda functions to write
 * to CloudWatch Logs.
 *
 * This is necessary for console#log statements to show up in CloudWatch Logs.
 */
function getCloudWatchLogsStatement (config) {
  return {
    Effect: 'Allow',
    Action: [
      'logs:CreateLogGroup',
      'logs:CreateLogStream',
      'logs:PutLogEvents'
    ],
    Resource: [
      util.format(
        // TODO: look at whether this can be more specific.
        'arn:aws:logs:%s:*:*',
        config.deployment.region
      )
    ]
  };
}

/**
 * Every role is given additional policies allowing permissions relating to S3
 * keys that are a part of the application.
 *
 * @param {Object} config The application configuration.
 * @return {Object} The statement.
 */
function getS3ArnMapStatement (config) {
  return {
    Effect: 'Allow',
    Action: [
      's3:GetObject'
    ],
    Resource: [
      util.format(
        'arn:aws:s3:::%s/%s',
        config.deployment.s3Bucket,
        utilities.getArnMapS3Key(config)
      )
    ]
  };
}

/**
 * Every role is given additional policies allowing permissions relating to S3
 * keys that are a part of the application.
 *
 * @param {Object} config The application configuration.
 * @return {Object} The statement.
 */
function getS3ApplicationConfirmationStatement (config) {
  return {
    Effect: 'Allow',
    Action: [
      's3:GetObject',
      's3:PutObject',
      's3:PutObjectAcl'
    ],
    Resource: [
      util.format(
        'arn:aws:s3:::%s/%s',
        config.deployment.s3Bucket,
        utilities.getApplicationConfirmationS3Key(config)
      )
    ]
  };
}

/**
 * Add to the outputs section of the template.
 *
 * @param {Object} template The CloudFormation template under construction.
 * @param {String} name The logical ID of the output.
 * @param {String} description A description.
 * @param {Object|String} value Usually a function call to obtain an ID.
 */
function setOutput (template, name, description, value) {
  template.Outputs[name] = {
    Description: description,
    Value: value
  };
}

/**
 * Set the description property for the template.
 *
 * @param {Object} template The CloudFormation template under construction.
 * @param {Object} config The application configuration.
 */
function setDescription (template, config) {
  template.Description = util.format(
    '%s: %s',
    config.name,
    config.version
  );
}

/**
 * Add the role resources specified in the configuration to the template.
 *
 * Each role is associated with one or more Lambda functions and provide
 * permissions allowing the Lambda functions to:
 *
 * - fetch the ARN map from S3.
 * - invoke the Lambda functions associated with this application.
 * - write to CloudWatch Logs.
 * - interact with the SQS queues associated with this application.
 * - perform actions associated with custom policy statements provided in the
 *   application configuration.
 *
 * @param {Object} template The CloudFormation template under construction.
 * @param {Object} config The application configuration.
 */
function setRoles (template, config) {
  var roleConfigurations = exports.getAllRoles(config);

  _.each(roleConfigurations, function (roleConfig) {
    // First create the skeleton of the role and its policy.
    var roleName = utilities.getRoleName(roleConfig.name);
    var role = {
      Type: 'AWS::IAM::Role',
      Properties: {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com'
              },
              Action: 'sts:AssumeRole'
            }
          ]
        },
        Path: '/',
        Policies: [
          {
            PolicyName: roleName,
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: []
            }
          }
        ]
      }
    };

    // Add the custom statements provided in the configuration.
    var statements = role.Properties.Policies[0].PolicyDocument.Statement = _.map(
      roleConfig.statements,
      function (statement) {
        return {
          Effect: statement.effect,
          Action: _.clone(statement.action),
          Resource: _.clone(statement.resource)
        };
      }
    );

    // Add statements for various permissions needed by all of the application
    // Lambda functions.
    statements.push(getQueuesStatement(config));
    statements.push(getConcurrencyQueuesStatement(config));
    statements.push(getLambdaFunctionsStatement(config));
    statements.push(getS3ArnMapStatement(config));
    statements.push(getS3ApplicationConfirmationStatement(config));
    statements.push(getCloudWatchLogsStatement(config));

    // Add this role to the template.
    template.Resources[roleName] = role;
  });
}

/**
 * Add the Lambda function resources to the template.
 *
 * @param {Object} template The CloudFormation template under construction.
 * @param {Object} config The application configuration.
 */
function setLambdaFunctions (template, config) {
  var components = common.getAllComponents(config);

  _.each(components, function (component) {
    var lambdaFunctionName = utilities.getLambdaFunctionName(component.name);
    var lambda = {
      Type: 'AWS::Lambda::Function',
      Properties: {
        Code: {
          S3Bucket: config.deployment.s3Bucket,
          S3Key: common.getComponentS3Key(component, config)
          // Not used here.
          //S3ObjectVersion: ''
        },
        Description: lambdaFunctionName,
        Handler: component.lambda.handler,
        MemorySize: component.lambda.memorySize || constants.lambda.MIN_MEMORY_SIZE,
        // Reference the role in this template for this Lambda function.
        Role: {
          'Fn::GetAtt': [
            utilities.getRoleName(component.lambda.role),
            'Arn'
          ]
        },
        Runtime: 'nodejs',
        Timeout: component.lambda.timeout || constants.lambda.MIN_TIMEOUT
      }
    };

    // Add Lambda function to template.
    template.Resources[lambdaFunctionName] = lambda;

    // Add a related output for the Lambda function ARN, as we'll need it to
    // set up the ARN map after deployment, but before starting up the
    // application.
    setOutput(
      template,
      utilities.getLambdaFunctionArnOutputName(component.name, config),
      lambdaFunctionName + ' ARN.',
      {
        'Fn::GetAtt': [
          lambdaFunctionName,
          'Arn'
        ]
      }
    );
  });
}

/**
 * Add the SQS queue resources for message components to the template.
 *
 * These are the queues used to deliver data to message component Lambda
 * functions.
 *
 * @param {Object} template The CloudFormation template under construction.
 * @param {Object} config The application configuration.
 */
function setMessageComponentQueues (template, config) {
  var components = common.getEventFromMessageComponents(config);

  _.each(components, function (component) {
    var queueName = utilities.getQueueName(component.name);
    var queue = {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: utilities.getFullQueueName(component.name, config),
        // This will be set to the same value as the timeout for the associated
        // component Lambda function.
        VisibilityTimeout: component.lambda.timeout || constants.lambda.MAX_TIMEOUT
        // Default values, not set.
        //DelaySeconds: 0,
        //MaximumMessageSize: 262144,
        //MessageRetentionPeriod: 345600,
        //ReceiveMessageWaitTimeSeconds: 0,
        // Not used.
        //RedrivePolicy: {
        //  deadLetterTargetArn: '',
        //  maxReceiveCount: 1
        //}
      }
    };

    // Add queue to the template.
    template.Resources[queueName] = queue;

    // Add a related output to obtain the queue ARN, as we'll need it to set up
    // the ARN map after deployment, but before starting up the application.
    setOutput(
      template,
      utilities.getQueueArnOutputName(component.name),
      queueName + ' ARN.',
      {
        'Fn::GetAtt': [
          queueName,
          'Arn'
        ]
      }
    );
  });
}

/**
 * Add the SQS queue resources for tracking concurrency to the template.
 *
 * Every component has an associated concurrency queue.
 *
 * @param {Object} template The CloudFormation template under construction.
 * @param {Object} config The application configuration.
 */
function setConcurrencyQueues (template, config) {
  var components = common.getAllComponents(config);

  _.each(components, function (component) {
    // Message retention period has a minimum of 60 seconds, unfortunately.
    //
    // Otherwise this should be set to the same value as the timeout for the
    // associated component Lambda function. If a component fails to remove a
    // concurrency-tracking message, that message should evaporate at the
    // timeout.
    var messageRetentionPeriod = Math.max(
      60,
      component.lambda.timeout || constants.lambda.MAX_TIMEOUT
    );

    var queueName = utilities.getConcurrencyQueueName(component.name);
    var queue = {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: utilities.getFullConcurrencyQueueName(component.name, config),
        // This will be set to the same value as the timeout for the associated
        // component Lambda function.
        VisibilityTimeout: component.lambda.timeout || constants.lambda.MAX_TIMEOUT,
        MessageRetentionPeriod: messageRetentionPeriod
        // Default values, not set.
        //DelaySeconds: 0,
        //MaximumMessageSize: 262144,
        //ReceiveMessageWaitTimeSeconds: 0,
        // Not used.
        //RedrivePolicy: {
        //  deadLetterTargetArn: '',
        //  maxReceiveCount: 1
        //}
      }
    };

    // Add queue to the template.
    template.Resources[queueName] = queue;

    // Add a related output to obtain the queue ARN, as we'll need it to set up
    // the ARN map after deployment, but before starting up the application.
    setOutput(
      template,
      utilities.getConcurrencyQueueArnOutputName(component.name),
      queueName + ' ARN.',
      {
        'Fn::GetAtt': [
          queueName,
          'Arn'
        ]
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Exported functions.
// ---------------------------------------------------------------------------

/**
 * Generate the CloudFormation template for the application.
 *
 * @param {Object} config Application config.
 * @param  {Function} callback Of the form function (error).
 */
exports.generateTemplate = function (config, callback) {
  var template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: '',
    // The generated template won't have any parameters, while resources and
    // outputs are filled in by below.
    Parameters: {},
    Resources: {},
    Outputs: {}
  };

  setDescription(template, config);
  setRoles(template, config);
  setLambdaFunctions(template, config);
  setMessageComponentQueues(template, config);
  setConcurrencyQueues(template, config);

  fs.writeJSON(
    common.getCloudFormationTemplatePath(config),
    template,
    {
      spaces: 2
    },
    callback
  );
};
