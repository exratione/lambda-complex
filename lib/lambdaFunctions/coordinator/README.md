# Coordinator Lambda Function

This package provides a default implementation of the Lambda Complex
coordinator Lambda function. It has both `coordinator` and `invoker` handles.

## Coordinator

The coordinator carries out the following functions:

- Assess current queue sizes per component.
- Invoke invokers for given components so as to clear queues at the desired
concurrency.
- Invoke another coordinator instance once the current instance is done.

## Invoker

The invoker exists to amplify the number of invocations a single Lambda function
instance can create in a given time. API requests take time and start to fail if
launched with too great a concurrency in any one thread.
