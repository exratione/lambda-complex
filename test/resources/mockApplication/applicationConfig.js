/**
 * @fileOverview A configuration for the mock application.
 */

// NPM.
var path = require('path');

module.exports = {
  name: 'mock',
  version: '0.1.0',
  deployId: 15,

  deployment: {
    region: 'us-east-1',
    s3Bucket: 'lambda-complex',
    s3KeyPrefix: 'applications/',
    // No additional tags.
    tags: {},
    // No additional duties for the switchover between versions of the
    // deployed application.
    switchoverFunction: function (stackDescription, config, callback) {
      callback();
    },
    skipPriorCloudFormationStackDeletion: false,
    skipPriorCloudWatchLogGroupsDeletion: false,
    skipCloudFormationStackDeletionOnFailure: false
  },

  coordinator: {
    coordinatorConcurrency: 2,
    // Keep these low to make inspection of test data easier.
    maxApiConcurrency: 4,
    maxInvocationCount: 6,
    minInterval: 10
  },

  roles: [
    // Not really used, just here to exercise code more completely.
    {
      name: 's3ReadA',
      statements: [
        {
          effect: 'Allow',
          action: 's3:get*',
          resource: [
            'arn:aws:s3:::exampleBucket1/*'
          ]
        }
      ]
    },
    {
      name: 's3ReadB',
      statements: [
        {
          effect: 'Allow',
          action: 's3:get*',
          resource: [
            'arn:aws:s3:::exampleBucket2/*'
          ]
        }
      ]
    }
  ],

  components: [
    {
      name: 'message',
      type: 'eventFromMessage',
      maxConcurrency: 10,
      queueWaitTime: 0,
      // Routing will be defined in tests as needed.
      // routing: undefined,
      lambda: {
        npmPackage: path.join(__dirname, 'mockLambdaFunction'),
        handler: 'index.handler',
        memorySize: 128,
        timeout: 60,
        role: 's3ReadA'
      }
    },

    {
      name: 'invocation',
      type: 'eventFromInvocation',
      // Routing will be defined in tests as needed.
      // routing: undefined,
      lambda: {
        npmPackage: path.join(__dirname, 'mockLambdaFunction'),
        handler: 'index.handler',
        memorySize: 128,
        timeout: 60,
        role: 's3ReadB'
      }
    }
  ]
};
