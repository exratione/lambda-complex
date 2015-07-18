/**
 * @fileOverview Main coordinator/invoker lambda function.
 *
 * When the coordinator handle is invoked this is responsible for:
 *
 * - Respawning itself.
 * - Monitoring queues.
 * - Invoking invoker lambda function instances.
 *
 * When the invoker handle is invoked this is responsible for:
 *
 * - Invoking component lambda function instances.
 */

var coordinator = require('coordinator');
var invoker = require('invoker');

exports.coordinator = coordinator.handler;
exports.invoker = invoker.handler;
