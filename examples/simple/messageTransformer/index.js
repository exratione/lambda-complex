/**
 * @fileOverview The messageTransformer Lambda function.
 */

/**
 * Send on the event data with a little decoration.
 *
 * @param {Object} event
 * @param {Object} context
 */
exports.handler = function (event, context) {
  event = event || {};
  event.param = 'transformed';

  context.succeed(event);
};
