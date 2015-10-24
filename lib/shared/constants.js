/**
 * @fileOverview Various constant values.
 *
 * Shared between deployment and deployed code.
 */

// Relating to Lambda limits.
exports.lambda = {
  // In MBs.
  MIN_MEMORY_SIZE: 128,
  MAX_MEMORY_SIZE: 1536,
  // In seconds.
  MIN_TIMEOUT: 3,
  MAX_TIMEOUT: 300
};

exports.componentType = {
  INTERNAL: 'internal',
  EVENT_FROM_MESSAGE: 'eventFromMessage',
  EVENT_FROM_INVOCATION: 'eventFromInvocation'
};

exports.coordinator = {
  NAME: 'lambdaComplexCoordinator',
  HANDLER: 'index.coordinator',
  MEMORY_SIZE: exports.lambda.MIN_MEMORY_SIZE,
  TIMEOUT: exports.lambda.MAX_TIMEOUT,
  ROLE: 'internalLambdaComplex',
};
// Useful to have a base component definition. Note that anything using this
// on the deployment side of the house will have to do something useful with
// the npmPackage property - point it in the right direction.
//
// On the deployed side of the house nothing cares about npmPackage.
exports.coordinator.COMPONENT = {
  name: exports.coordinator.NAME,
  type: exports.componentType.INTERNAL,
  lambda: {
    npmPackage: undefined,
    handler: exports.coordinator.HANDLER,
    memorySize: exports.coordinator.MEMORY_SIZE,
    timeout: exports.coordinator.TIMEOUT,
    role: exports.coordinator.ROLE
  }
}

exports.invoker = {
  NAME: 'lambdaComplexInvoker',
  HANDLER: 'index.invoker',
  MEMORY_SIZE: exports.lambda.MIN_MEMORY_SIZE,
  TIMEOUT: exports.lambda.MAX_TIMEOUT,
  ROLE: 'internalLambdaComplex',
};
// Useful to have a base component definition. Note that anything using this
// on the deployment side of the house will have to do something useful with
// the npmPackage property - point it in the right direction.
//
// On the deployed side of the house nothing cares about npmPackage.
exports.invoker.COMPONENT = {
  name: exports.invoker.NAME,
  type: exports.componentType.INTERNAL,
  lambda: {
    npmPackage: undefined,
    handler: exports.invoker.HANDLER,
    memorySize: exports.invoker.MEMORY_SIZE,
    timeout: exports.invoker.TIMEOUT,
    role: exports.invoker.ROLE
  }
}
