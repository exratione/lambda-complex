/**
 * @fileOverview A test case for handling uncaught exceptions.
 *
 * Load this in its own process after the mock application has been built.
 */

// Core.
var path = require('path');

// Local.
var resources = require('./index');
var applicationConfig = require('./mockApplication/applicationConfig');

// Get the various test globals set up.
require('../mochaInit');

var invocationPackageDir = path.resolve(
  resources.getScratchDirectory(),
  applicationConfig.name,
  'invocation'
);

var invocationOriginalIndex = require(path.resolve(
  invocationPackageDir,
  '_index'
));

// Since we're loading this here, it will attempt to catch any exception that
// happens due to errors in this test code. That will still effectively fail
// the test, but the errors may be misleading.
var invocationIndex = require(path.resolve(
  invocationPackageDir,
  'index'
));

// Make the original handler throw.
sinon.stub(invocationOriginalIndex, 'handler').throws();

// Stub everything relevant to this experiment in the wrapper.
sinon.stub(invocationIndex.lc, 'sendData').yields();
sinon.stub(invocationIndex.lc, 'deleteMessageFromInputQueue').yields();
sinon.stub(invocationIndex.lc.utilities, 'loadArnMap').yields(
  null,
  resources.getMockArnMap(applicationConfig)
);
sinon.stub(invocationIndex.lc.utilities, 'incrementConcurrencyCount').yields();
sinon.stub(invocationIndex.lc.utilities, 'decrementConcurrencyCount').yields();
sinon.stub(invocationIndex.lc.utilities, 'receiveMessage').yields(null, {
  message: '{}',
  receiptHandle: 'receiptHandle'
});

var event = {};
var context = {
  done: sinon.stub(),
  fail: sinon.stub(),
  getRemainingTimeInMillis: sinon.stub(),
  succeed: sinon.stub()
};

setTimeout(function () {
  // Did the finalizing functions still get called?
  sinon.assert.calledOnce(invocationIndex.lc.sendData);
  sinon.assert.calledOnce(invocationIndex.lc.utilities.decrementConcurrencyCount);
  sinon.assert.calledWith(
    context.fail,
    sinon.match.instanceOf(Error)
  );

  // This is useful for pattern matching in stdout. It will only appear if
  // everything worked according to plan - errors will derail the flow of
  // execution before it gets to this point.
  console.info('SUCCESS');
}, 20);

// This should throw, but trigger the actions that are checked above.
invocationIndex.handler(event, context);
