/**
 * @fileOverview Configuration for a simple Lambda Complex example application.
 *
 * See examples/exampleApplicationConfig.js for comments explaining the various
 * options and parameters.
 */

var path = require('path');

module.exports = {
  name: 'simple',
  version: '0.1.0',
  // Use a unix timestamp for the deploy ID for the sake of simplicity.
  deployId: Math.round((new Date()).getTime() / 1000),

  deployment: {
    // Set the desired region.
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
    developmentMode: false
  },

  coordinator: {
    coordinatorConcurrency: 1,
    maxApiConcurrency: 10,
    maxInvocationCount: 20,
    minInterval: 10
  },

  roles: [
    {
      name: 'default',
      // No extra statements beyond those added by default to access queues.
      statements: []
    }
  ],

  components: [
    {
      name: 'invokedProcessor',
      type: 'eventFromInvocation',
      // Since this defines no routing, this is a dead end: events are delivered
      // here and no further processing results.
      // routing: undefined,
      lambda: {
        npmPackage: path.join(__dirname, 'processor'),
        handler: 'index.handler',
        memorySize: 128,
        timeout: 60,
        role: 'default'
      }
    },

    {
      name: 'messageProcessor',
      type: 'eventFromMessage',
      queueWaitTime: 5,
      // Since this defines no routing, this is a dead end: events are delivered
      // here and no further processing results.
      // routing: undefined,
      lambda: {
        npmPackage: path.join(__dirname, 'processor'),
        handler: 'index.handler',
        memorySize: 128,
        timeout: 60,
        role: 'default'
      }
    },

    {
      name: 'messageTransformer',
      type: 'eventFromMessage',
      queueWaitTime: 5,
      /**
       * A routing function to send data resulting from this component's Lambda
       * function invocation to other components based on its contents.
       *
       * Remember that (a) the routing function cannot include any reference to
       * resources that don't exist in this component Lamdba function, and
       * (b) this config will be included and loaded in other places that don't
       * have the same set of NPM modules available as this Lamdba function.
       *
       * That doesn't matter in this case, but it would if we used require() to
       * load modules.
       *
       * @param {Error} error An Error instance.
       * @param {Mixed} data Results of the Lambda function invocation.
       */
      routing: function (error, data) {
        // Don't send on any data to other components if there was an error in
        // processing.
        if (error) {
          return [];
        }

        var json = JSON.stringify(data);
        var destination;

        if (json.length % 2 === 1) {
          destination = 'messageProcessor';
        }
        else {
          destination = 'invokedProcessor';
        }

        return [
          {
            name: destination,
            data: data
          }
        ];
      },
      lambda: {
        npmPackage: path.join(__dirname, 'messageTransformer'),
        handler: 'index.handler',
        memorySize: 128,
        timeout: 60,
        role: 'default'
      }
    }
  ]
};
