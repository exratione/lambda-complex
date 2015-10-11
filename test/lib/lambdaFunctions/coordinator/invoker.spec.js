/**
 * @fileOverview Tests for lib/lambdaFunctions/coordinator/invoker.js.
 */

// Core.
var path = require('path');

// Local.


var resources = require('../../../resources');
var applicationConfig = require('../../../resources/mockApplication/applicationConfig');
var scratchDir = resources.getScratchDirectory();
var mockApplicationDir = path.join(scratchDir, applicationConfig.name);

describe('lib/lambdaFunctions/coordinator/invoker', function () {

  var arnMap;
  var common;
  var invoker;
  var sandbox;
  var utilities;

  before(function (done) {
    // Needs time to set up the mock application as there are npm install
    // commands in there.
    this.timeout(30000);
    // Set up the mock application.
    resources.setUpMockApplication(applicationConfig, done);
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    common = require(path.join(
      mockApplicationDir,
      'lambdaComplexCoordinator',
      'common'
    ));
    constants = require(path.join(
      mockApplicationDir,
      'lambdaComplexCoordinator',
      '_constants'
    ));
    invoker = require(path.join(
      mockApplicationDir,
      'lambdaComplexCoordinator',
      'invoker'
    ));
    utilities = require(path.join(
      mockApplicationDir,
      'lambdaComplexCoordinator',
      '_utilities'
    ));

    sandbox.stub(console, 'info');

    arnMap = resources.getMockArnMap(applicationConfig);
    invoker.arnMap = arnMap;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('handler', function () {
    var event;
    var context;

    beforeEach(function () {
      event = {
        components: [
          {
            name: 'componentName',
            count: 10
          }
        ]
      };
      context = {
        done: sandbox.stub()
      };

      // This function is expected to set the ARN map.
      invoker.arnMap = undefined;

      sandbox.stub(utilities, 'loadArnMap').yields(null, arnMap);
      sandbox.stub(utilities, 'incrementConcurrencyCount').yields();
      sandbox.stub(utilities, 'decrementConcurrencyCount').yields();
      sandbox.stub(common, 'invokeApplicationLambdaFunctions').yields();
    });

    it('calls expected functions', function (done) {
      invoker.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          utilities.loadArnMap,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );
        sinon.assert.calledWith(
          utilities.incrementConcurrencyCount,
          constants.invoker.COMPONENT,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          common.invokeApplicationLambdaFunctions,
          event.components,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          utilities.decrementConcurrencyCount,
          constants.invoker.COMPONENT,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done,
          null,
          event.components
        );

        done();
      }, 20);
    });

    it('defaults to empty component array', function (done) {
      event = {};
      invoker.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          common.invokeApplicationLambdaFunctions,
          [],
          arnMap,
          sinon.match.func
        );

        done();
      }, 20);
    });

    it('errors on failure of loadArnMap', function (done) {
      sandbox.stub(console, 'error');
      utilities.loadArnMap.yields(new Error());

      invoker.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error),
          event.components
        );

        done();
      }, 20);
    });

    it('proceeds after increment error', function (done) {
      sandbox.stub(console, 'error');
      utilities.incrementConcurrencyCount.yields(new Error());

      invoker.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          utilities.loadArnMap,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );
        sinon.assert.calledWith(
          utilities.incrementConcurrencyCount,
          constants.invoker.COMPONENT,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          common.invokeApplicationLambdaFunctions,
          event.components,
          arnMap,
          sinon.match.func
        );
        sinon.assert.notCalled(utilities.decrementConcurrencyCount);
        sinon.assert.calledWith(
          context.done,
          null,
          event.components
        );

        done();
      }, 20);
    });


    it('errors on failure of invokeApplicationLambdaFunctions', function (done) {
      sandbox.stub(console, 'error');
      common.invokeApplicationLambdaFunctions.yields(new Error());

      invoker.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error),
          event.components
        );

        done();
      }, 20);
    });

    it('errors on failure of decrementConcurrencyCount', function (done) {
      sandbox.stub(console, 'error');
      utilities.decrementConcurrencyCount.yields(new Error());

      invoker.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error),
          event.components
        );

        done();
      }, 20);
    });
  });

});
