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
          common.invokeApplicationLambdaFunctions,
          event.components,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done
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
      utilities.loadArnMap.yields(new Error());

      invoker.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });

    it('errors on failure of invokeApplicationLambdaFunctions', function (done) {
      common.invokeApplicationLambdaFunctions.yields(new Error());

      invoker.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });
  });

});
