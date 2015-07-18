/**
 * @fileOverview Various constant values.
 */

// Relating to Lamdba limits.
exports.lambda = {
  // In MBs.
  MIN_MEMORY_SIZE: 128,
  MAX_MEMORY_SIZE: 1536,
  // In seconds.
  MIN_TIMEOUT: 3,
  MAX_TIMEOUT: 300
};

exports.coordinator = {
  NAME: 'lambdaComplexCoordinator',
  HANDLE: 'index.coordinator',
  MEMORY_SIZE: exports.lambda.MIN_MEMORY_SIZE,
  TIMEOUT: exports.lambda.MAX_TIMEOUT,
  ROLE: 'internalLambdaComplex'
};

exports.invoker = {
  NAME: 'lambdaComplexInvoker',
  HANDLE: 'index.invoker',
  MEMORY_SIZE: exports.lambda.MIN_MEMORY_SIZE,
  TIMEOUT: exports.lambda.MAX_TIMEOUT,
  ROLE: 'internalLambdaComplex'
};

exports.componentType = {
  INTERNAL: 'internal',
  EVENT_FROM_MESSAGE: 'eventFromMessage',
  EVENT_FROM_INVOCATION: 'eventFromInvocation'
};
