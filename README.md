# Lambda Complex

Lambda Complex is a Node.js framework for applications that run entirely within
Lambda, SQS, and other high abstraction layer AWS services. The high points of
Lambda Complex:

* Assemble applications from any Node.js Lambda function implementations.
* Use any NPM module that exports one or more Lambda function handlers, or write
your own.
* Configure the Lambda Complex application to pass data between Lambda function
invocations or accept data from SQS queues.
* Lambda complex applications are deployed as CloudFormation stacks.

A Lambda Complex application is deployed from a developer machine, or from an
Amazon Linux EC2 instance if binary NPM modules are required, and no server
infrastructure beyond that is needed.

The typical Lambda Complex application consists of a few small Node.js packages
exposing Lambda function handlers, and a configuration file to define necessary
details such as permissions to access AWS resources. When deployed, the Lambda
functions interact with other AWS services to, for example, generate content in
response to SQS messages, or process a workflow in many small steps.

## Why Lambda Complex?

The name? Because it involves AWS Lambda and it is a little bit complicated.

Joining together many Lambda functions to form an application might sound a
little like reinventing the wheel, given the existence of AWS Simple Workflow
Service and other similar frameworks. Why do this, especially given the work
needed to factor any complex application into functions that will run within the
time, memory, thread, and other constraints of AWS Lambda?

The answer is that this is largely a way to flee from devops requirements in
more traditional server deployments. A Lambda Complex application requires no
servers and thus no complicated deployment infrastructure. No provisioning
scripts, no upgrade treadmill, no version conflicts: this particular combination
of AWS services abstracts away all of that. Just design the application, write
the code, write the configuration file, run the deployment script, and you are
done and deployed, your application running.

Lambda Complex is well suited to non-realtime content generation needs, such as
high concurrency file creation in response to requests placed into an SQS queue.

## Examples

You should find the following examples informative if looking for details, or
help in constructing your own application:

* An [example application configuration file][1] with documentation.
* A [simple example application][2].

## Basic Concepts

### Application Configuration File

A Lambda Complex application is defined by a configuration file that specifies
the AWS details, the components and their Lambda function packages, the IAM
roles to grant access to AWS resources, and other necessary items.

### Component

A Lambda Complex component consists of:

* A Lambda function implementation.
* An SQS queue to measure concurrency.
* A method of passing data to the Lambda function data, such as an SQS queue.
* The component definition in the Lambda Complex application configuration file.

The following types of component exist:

#### Event From Message

The component is bound to a specific queue, and when invoked will consume a
message from that queue to provide the event data passed to the handler.

This type of component has a specified concurrency, and is limited to that
number of concurrent invocations when the queue is populated. The coordinator
periodically invokes instances of the component Lambda function when the queue
has visible messages.

If the component fails in its operation, the message remains in the queue and
will be retried. Therefore this type of Lambda function can be written to fail
fast and with no intricate error handling.

#### Event From Invocation

The component is a normal Lambda function, and event data is passed to the
handler in the normal way. The component Lambda function is invoked by other
component Lamdbda functions directly, without intervention of the coordinator.

The advantage of this is speed, not having to wait for a queue check, while the
disadvantage that this component must be absolutely bulletproof or data and
operations will be lost when it fails.

#### Internal

Internal components are built-in Lambda functions that manage the operation of
a Lambda Complex application, such as responding to queues backlogs.

### Lambda Complex Code Wraps Provided Lambda Function Implementations

Lambda Complex applications can use arbitrary third party Lambda function
handler implementations, so long as they are Node.js and have a `package.json`
file, because during deployment those implementations are wrapped in Lambda
Complex code.

When the component Lambda function is invoked in a deployed Lambda Complex
application, Lambda Complex code runs first to take care of the necessary
details - such as retrieving data from an SQS queue, tracking concurrency, and
so forth. Only then does it pass control to the underlying Lambda function
handler.

### Coordinator

The coordinator is a built-in Lambda Complex Lambda function that checks the
state of the running application and invokes Lambda functions in response to
circumstances. E.g. on the arrival of new messages in SQS queues.

### Invoker

The invoker is a built-in Lambda Complex Lambda function that is used to invoke
large numbers of other Lambda functions. API calls take time, and a Lambda
function instance is both time-limited and thread-limited. Therefore invoking
a very large number of Lambda function instances requires the creation of
additional invoker instances to carry out that work.

### Concurrency Queues

Each component is associated with an SQS queue used to measure the number of
concurrent invocations of the component Lambda function. When the component
Lambda function is invoked, a message is posted to the queue. That message is
deleted on completion of the Lambda function, or expires after the Lambda
function timeout.

Note that queue messages cannot expire more rapidly than 60 seconds, and Lambda
functions can have shorter timeouts. This shouldn't be too much of an issue
since Lambda Complex reactions to uncaught exceptions to take the necessary
actions - it is fairly hard to cause the concurrency message deletion to fail
to take place.

### ARN Map

During deployment of the CloudFormation stack for a Lambda Complex application,
a JSON map of the relevant ARNs for queues and Lambda functions is created and
uploaded to S3. This file is necessary for the Lambda Complex framework code to
function, and is loaded by every invoked Lambda function before they take
action.

## Creating a Lambda Complex Application

### Design the Application

Break up your application functionality into small chunks that can run in
parallel, and which individually cannot last longer than the Lambda time limit
(currently 300 seconds). Each of these is a component. Identify the data that
passes from component to component, and points at which flow control decisions
must be made: route to component `A` versus component `B` based on the data.

Not all applications are a good fit for Lambda Complex, and it is worth taking a
little time to figure out whether or not this is a good plan for any specific
use case.

For each component you will need to write or use a third party Lambda function
provided in an NPM package.

## Create the Application Configuration File

The [example configuration file][1] provides a good starting point, as it
contains examples of nearly all that is needed to specify much larger
applications.

### Specify Deployment Details

Specify the necessary deployment details:

```
{
  name: 'simple',
  version: '0.1.0',
  // Add
  deployId: Math.round((new Date()).getTime() / 1000),

  deployment: {
    region: 'us-east-1',
    s3Bucket: 'lambda-complex',
    s3KeyPrefix: 'applications/',
    // No additional tags.
    tags: {},
    switchoverFunction: function (stackDescription, config, callback) {
      callback();
    },
    developmentMode: false
  },
```

The most important, and potentially most complex, item here is the
`switchoverFunction`. This is invoked after deployment of a new version of the
application, but prior to deletion of the previous version of the application.
It should be used to make any changes needed to switch resources to use the
new applications.

In a Lambda Complex application, this means the SQS queues that will be used to
introduce data into the application: the new queues will have different
identities, and the applications sending to them should be updated.

### Configure the Coordinator Behavior

The coordinator configuration is as important as the `concurrency` property of
components when tailoring an application to work within the Lambda limits placed
on an AWS account. See the example configuration for an explanation of these
properties, and note that it is perfectly possible to set values that are too
high for a coordinator invocation to complete without error.

```
  coordinator: {
    coordinatorConcurrency: 1,
    maxApiConcurrency: 10,
    maxInvocationCount: 20,
    minInterval: 10
  },
```

### Add Component and Role Definitions

For each component identified in the design, create a definition in the
`components` array. Most components will be of the `eventFromMessage` type and
this associated with an SQS queue.

Each component must have an associated role, applied to its Lambda function.
Add these to the `roles` array.

```
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
    }
  ],
```

For most components the `routing` property is important: it determines which
other components accept the output of this component as their input. This can be
a component name, array of component names, or a function:

```
    routing: 'aComponent',

    ...

    routing: ['component1', 'component2'],

    ...

    routing: function (error, data) {
      // This is safe provided that the Lambda function for this component
      // includes the underscore module.
      var _ = require('underscore');

      // Don't send on any data if an error resulted.
      if (error) {
        return [];
      }

      // Otherwise split up or manipulate data and send it to other
      // components as desired.
      return [
        { name: 'componentA', data: _.keys(data) },
        { name: 'componentB', data: _.values(data) }
      ];
    },
```

### Write the Lambda Functions

A Lambda function for use in a Lambda Complex application is written in the
normal way. The result it returns to `context.succeed` or `context.done` may be
routed to one or more other components depending on definitions in the
application configuration file.

Thus any suitable NPM module that provides exported handle functions that
conform to the Lambda specification can be used. As a reminder, these functions
must be of the form:

```
exports.fn = function (event, context) {
  var result = {
    name: 'value'
  };

  context.succeed(result);
}
```

A function must invoke the `context` methods on completion to provide data that
can be passed on to other components in the application.

### Set up AWS Credentials

For deployment to work, suitable AWS credentials for the account specified in
the configuration file must be present. The credentials must at a minimum
allow interaction with CloudFormation stacks, Lambda functions, SQS queues, and
roles.

To make credentials available for Lambda Complex, either create a credentials
file in the standard location or set environment variables to hold the key and
secret key. Both options are [described in the AWS SDK documentation][3].

Unlike many Node.js AWS modules, Lambda Complex does not accept IAM access keys
directly in configuration. It is bad practice to specify access keys in code or
configuration for code; you should always add them to the environment in one of
the ways noted above.

## Working With a Lambda Complex Application

### Deploy the Application

Once the Javascript configuration file is ready, deploy the application via a
Grunt task. Note that the `config-path` option can be set to a relative or
absolute path:

```
grunt deploy --config-path=/path/to/applicationConfig.js
```

Deployment uses the [cloudformation-deploy NPM module][4], so you may want to
take a look at its documentation. In short, the following occurs:

* Request stack creation.
* Wait on the stack status to show show success.
* Run the provided `config.deployment.switchoverFunction`.
* Delete any previous instances of the stack once the switchover is done.

### Shut Down an Application

Since the application includes self-invoking Lambda functions, the only sure
way to shut it down at the present time is to delete the CloudFormation stack.
Deleting the ARN map file uploaded to S3 during application deployment should
also shut things down, as without the list of ARNs for application resources
nothing in Lambda Complex can work.

### Update a Deployed Application

To update the deployed application, simply deploy again. A new stack will be
created and the old stack destroyed when (a) creation is complete and (b) the
`config.deployment.switchoverFunction` calls back.

If you are using SQS queues to pass data into the application, note that this
will require you to update the queue names. This should be accomplished in the
`switchoverFunction` defined in the application configuration, which will be
invoked after creation is successful but before deletion of the prior
application stack.

### Monitor a Running Application

Lambda functions write to CloudWatch Logs and other attributes such as number
of invocations and errors can be monitored via the CloudWatch API. The component
SQS queues can also be monitored via CloudWatch.

A number of third party services can be used to build monitors and alerts based
on these logs and metrics.

## A Speculative Roadmap

Lambda Complex remains in an early stage of development. Moving forward the
following are intended.

### Concurrency Limits

Add the ability to count concurrency of Lambda function invocations, and limit
concurrency for queue-based components.

### Monitoring and Log Streaming

A robust monitoring and log streaming module is needed, built on the CloudWatch
APIs. A programmatic interface to how the applications is working (or not
working) is a necessary part of a number of further refinements.

### Detection of Coordinator Failure on Deployment

The ability to detect whether or not the coordinator runs successfully when a
new version is deployed is much needed. This should count as a failed
deployment, and thus not trigger switchover and deletion of the existing stack.

### Concurrent Coordinators

For robustness, multiple coordinator invocations should run concurrently, each
taking a fraction of the load of invocation. This should be coupled with
CloudWatch monitoring to determine the number of running coordinators, and thus
restore any that have failed.

### More Component Types

Add further component types based on other ways to trigger Lambda functions
from AWS resources. E.g. from S3 events or SNS topics.

### Application Testbed

Providing the ability to run an application locally.

### Stress Testing

Tools to stress test a local or deployed application.

[1]: ./examples/exampleApplicationConfig.js
[2]: ./examples/simple
[3]: http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html
[4]: https://github.com/exratione/cloudformation-deploy
