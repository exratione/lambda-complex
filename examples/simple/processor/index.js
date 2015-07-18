/**
 * @fileOverview A processor Lambda function definition.
 */

/**
 * Process the provided event.
 *
 * @param {Object} event
 * @param {Object} context
 */
exports.handler = function (event, context) {
  // Processing is this case is nothing more exciting than logging the event
  // JSON.
  console.info(JSON.stringify(event, null, '  '));
  context.succeed();
};
