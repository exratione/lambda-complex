# Coordinator Lambda Function

This package provides a default implementation of the Lambda Complex
coordinator Lambda function. It includes both `coordinator` and `invoker`
handles.

## Coordinator

The coordinator carries out the following functions:

- Assess current queue sizes per component.
- Invoke invokers or other component Lambda functions so as to clear queues at
the desired concurrency.
- Invoke other coordinator instances once the current instance is done to keep
the coordinator concurrency at the desired level.

## Invoker

The invoker exists to amplify the number of invocations a single Lambda function
instance can create in a given time. API requests take time and start to fail if
launched with too great a concurrency in any one Node.js process.
