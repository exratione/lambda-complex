# Simple Lambda Complex Example

This is a very simple example Lambda Complex application that reads input data
from a queue, transforms it, and takes action on it at a set concurrency. The
components created on deployment are:

* `simple-<deployId>-MessageTransformerQueue` SQS queue.
* `simple-<deployId>-MessageProcessorQueue` SQS queue.
* `simple-<deployId>-MessageTransformerConcurrencyQueue` SQS queue.
* `simple-<deployId>-MessageProcessorConcurrencyQueue` SQS queue.
* `simple-<deployId>-LambdaComplexCoordinatorConcurrencyQueue` SQS queue.
* `simple-<deployId>-LambdaComplexInvokerConcurrencyQueue` SQS queue.
* `simple-<deployId>-MessageTransformer-<assignedId>` Lambda function.
* `simple-<deployId>-MessageProcessor-<assignedId>` Lambda function.
* `simple-<deployId>-InvokedProcessor-<assignedId>` Lambda function.
* `simple-<deployId>-LambdaComplexCoordinator-<assignedId>` Lambda function.
* `simple-<deployId>-LambdaComplexInvoker-<assignedId>` Lambda function.

## How the Application Functions

The `simple-<deployId>-LambdaComplexCoordinator-<assignedId>` Lambda function
constantly invokes itself to monitors queues and invoke other Lambda functions
in response to the presence of queue messages. The entry point for data into the
application is the `simple-<deployId>-MessageTransformerQueue` queue. Messages
added there will cause the coordinator to invoke the
`simple-<deployId>-MessageTransformer-<assignedId>` Lambda function once per
message.

The `simple-<deployId>-MessageTransformer-<assignedId>` Lambda function consumes
a message from the `simple-<deployId>-MessageTransformerQueue` queue, alters the
message contents, and then passes that data on to either the
`simple-<deployId>-MessageProcessor-<assignedId>` function or the
`simple-<deployId>-InvokedProcessor-<assignedId>` Lambda function depending on
the length of the contents.

If sending the data to the `simple-<deployId>-MessageProcessor-<assignedId>`
function it adds a message containing the data to the
`simple-<deployId>-MessageProcessorQueue` queue.

If sending the data to the `simple-<deployId>-InvokedProcessor-<assignedId>`
function, then it invokes that function directly.

Both of the processor Lambda functions use the same underlying NPM package and
function. The only difference is how they are invoked, either directly or in
response to a queue message.

The processor function simply logs the message it receives and then exits.

## Illustrating the Basics

Obviously this is trivial and contrived, but serves to show off the basics:

* Lambda Complex application configuration and deployment.
* Lambda functions reading from queues.
* Lambda function `A` passing data to Lambda function `B` via a queue.
* Lambda function `A` directly invoking Lambda function `B` to pass data.

A real Lambda Complex application will use these same building blocks, but to a
more constructive end.

## Configuring the Application

Update `examples/simple/applicationConfig.js` to set the following properties to
match the AWS account to deploy into:

* `region`
* `s3Bucket`
* `s3KeyPrefix`

## Launching the Application

After configuring `examples/simple/applicationConfig.js`, run the following:

```
grunt deploy --config-path=examples/simple/applicationConfig.js
```

## Setting the Application in Motion

Once deployment is complete, add messages containing any valid JSON string to
the `simple-<deployId>-MessageTransformer-<assignedId>` queue to see the Lambda
functions triggered in response.
