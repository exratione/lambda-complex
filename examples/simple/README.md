# Simple Lambda Complex Example

This is a very simple example Lambda Complex application that reads input data
from a queue, transforms it, and takes action on it at a set concurrency. The
components created on deployment are:

* `simple-<deployId>-MessageTransformerQueue` SQS queue.
* `simple-<deployId>-MessageProcessorQueue` SQS queue.
* `simple-<deployId>-MessageTransformer-<assignedId>` Lambda function.
* `simple-<deployId>-MessageProcessor-<assignedId>` Lambda function.
* `simple-<deployId>-InvokedProcessor-<assignedId>` Lambda function.
* `simple-<deployId>-LambdaComplexCoordinator-<assignedId>` Lambda function.
* `simple-<deployId>-LambdaComplexInvoker-<assignedId>` Lambda function.

The `simple-<deployId>-MessageTransformer-<assignedId>` Lambda function consumes
messages from the `simple-<deployId>-MessageTransformerQueue` queue, alters the
message contents, and then passes that data on to either the
`simple-<deployId>-MessageProcessor-<assignedId>` function or the
`simple-<deployId>-InvokedProcessor-<assignedId>` Lambda function depending on
the length of the contents.

If sending the data to the `simple-<deployId>-MessageProcessor-<assignedId>`
function then it is send by adding a message containing the data to the
`simple-<deployId>-MessageProcessorQueue`.

If sending the data to the `simple-<deployId>-InvokedProcessor-<assignedId>`
function, then that function is invoked directly.

Both of the processor Lambda functions use the same underlying NPM package and
function. The only difference is how they are invoked, either directly or in
response to a queue message.

## Illustrating the Basics

Obviously this is trivial and contrived, but serves to show off the basics:

* Lambda Complex application configuration and deployment.
* Lambda functions reading from queues.
* Lambda function `A` passing data to Lambda function `B` via a queue.
* Lamdba function `A` directly invoking Lambda function `B` to pass data.

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

Once deployment is complete, add messages to the
`simple-<deployId>-MessageTransformer-<assignedId>` queue to see the Lambda
functions triggered in response. The message body can consist of any valid JSON.
