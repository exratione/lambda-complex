/**
 * @fileOverview Tests for lib/lambdaFunctions/coordinator/coordinator.js.
 */

// Core.
var path = require('path');

// Local.
var resources = require('../../../resources');
var applicationConfig = require('../../../resources/mockApplication/applicationConfig');
var scratchDir = resources.getScratchDirectory();
var mockApplicationDir = path.join(scratchDir, applicationConfig.name);

describe('lib/lambdaFunctions/coordinator/coordinator', function () {

  var arnMap;
  var common;
  var constants;
  var coordinator;
  var event;
  var incrementedEvent;
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
    coordinator = require(path.join(
      mockApplicationDir,
      'lambdaComplexCoordinator',
      'coordinator'
    ));
    utilities = require(path.join(
      mockApplicationDir,
      'lambdaComplexCoordinator',
      '_utilities'
    ));

    sandbox.stub(console, 'info');

    arnMap = resources.getMockArnMap(applicationConfig);
    coordinator.arnMap = arnMap;
    event = {};
    incrementedEvent = {
      generation: 1
    };
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('determineApplicationStatus', function () {
    var messageCount = 10;

    beforeEach(function () {
      sandbox.stub(console, 'error');
      sandbox.stub(utilities, 'getQueueMessageCount').yields(null, messageCount);
    });

    it('yields expected status object for application config', function (done) {
      coordinator.determineApplicationStatus(function (error, status) {

        sinon.assert.callCount(utilities.getQueueMessageCount, 5);
        sinon.assert.calledWith(
          utilities.getQueueMessageCount,
          sinon.match.string,
          sinon.match.func
        );

        expect(status).to.eql({
          components: [
            {
              name: constants.coordinator.NAME,
              type: constants.componentType.INTERNAL,
              concurrency: messageCount
            },
            {
              name: constants.invoker.NAME,
              type: constants.componentType.INTERNAL,
              concurrency: messageCount
            },
            {
              name: 'message',
              type: constants.componentType.EVENT_FROM_MESSAGE,
              concurrency: messageCount,
              maxConcurrency: 10,
              queuedMessageCount: messageCount
            },
            {
              name: 'invocation',
              type: constants.componentType.EVENT_FROM_INVOCATION,
              concurrency: messageCount
            }
          ]
        });

        done(error);
      });
    });

    it('getQueueAttributes error is logged and message counts are null', function (done) {
      utilities.getQueueMessageCount.yields(new Error());

      coordinator.determineApplicationStatus(function (error, status) {
        sinon.assert.callCount(console.error, 5);
        expect(status).to.eql({
          components: [
            {
              name: constants.coordinator.NAME,
              type: constants.componentType.INTERNAL,
              concurrency: null
            },
            {
              name: constants.invoker.NAME,
              type: constants.componentType.INTERNAL,
              concurrency: null
            },
            {
              name: 'message',
              type: constants.componentType.EVENT_FROM_MESSAGE,
              concurrency: null,
              maxConcurrency: 10,
              queuedMessageCount: null
            },
            {
              name: 'invocation',
              type: constants.componentType.EVENT_FROM_INVOCATION,
              concurrency: null
            }
          ]
        });

        done(error);
      });
    });
  });

  describe('ensureCoordinatorConcurrency', function () {
    var applicationStatus;

    beforeEach(function () {
      applicationStatus = {
        components: [
          {
            name: constants.coordinator.NAME,
            type: constants.componentType.INTERNAL,
            concurrency: 1
          }
        ]
      };

      // Doesn't run on the first generation.
      incrementedEvent.generation = 2;

      sandbox.stub(utilities, 'invoke').yields();
    });

    it('invokes an additional coordinator', function (done) {
      coordinator.ensureCoordinatorConcurrency(
        applicationStatus,
        incrementedEvent,
        function (error) {
          sinon.assert.calledOnce(utilities.invoke);
          sinon.assert.calledWith(
            utilities.invoke,
            utilities.getLambdaFunctionArn(
              constants.coordinator.NAME,
              arnMap
            ),
            incrementedEvent,
            sinon.match.func
          );

          done(error);
        }
      );
    });

    it('skips invocation if unneeded', function (done) {
      applicationStatus.components[0].concurrency = 2;

      coordinator.ensureCoordinatorConcurrency(
        applicationStatus,
        incrementedEvent,
        function (error) {
          sinon.assert.notCalled(utilities.invoke);
          done(error);
        }
      );
    });

    it('skips over this step on generation 1', function (done) {
      incrementedEvent.generation = 1;

      coordinator.ensureCoordinatorConcurrency(
        applicationStatus,
        incrementedEvent,
        function (error) {
          sinon.assert.notCalled(utilities.invoke);
          done(error);
        }
      );
    });
  });

  describe('handler', function () {
    var applicationStatus;
    var invocationCounts;
    var context;

    beforeEach(function () {
      applicationStatus = {
        components: []
      };
      invocationCounts = [];
      context = {
        done: sandbox.stub()
      };

      // This function is expected to set the ARN map.
      coordinator.arnMap = undefined;

      sandbox.stub(utilities, 'loadArnMap').yields(null, arnMap);
      sandbox.stub(utilities, 'incrementConcurrencyCount').yields();
      sandbox.stub(common, 'ensureInterval').yields();
      sandbox.stub(common, 'getInvocationCounts').returns(invocationCounts);
      sandbox.stub(common, 'invokeApplicationLambdaFunctions').yields();
      sandbox.stub(coordinator, 'determineApplicationStatus').yields(
        null,
        applicationStatus
      );
      sandbox.stub(coordinator, 'ensureCoordinatorConcurrency').yields();
      sandbox.stub(utilities, 'decrementConcurrencyCount').yields();
      sandbox.stub(utilities, 'invoke').yields();
    });

    it('calls expected functions', function (done) {
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          utilities.loadArnMap,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );
        sinon.assert.calledWith(
          utilities.incrementConcurrencyCount,
          constants.coordinator.COMPONENT,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          coordinator.determineApplicationStatus,
          sinon.match.func
        );
        sinon.assert.calledWith(
          coordinator.ensureCoordinatorConcurrency,
          applicationStatus,
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          common.getInvocationCounts,
          applicationStatus
        );
        sinon.assert.calledWith(
          common.invokeApplicationLambdaFunctions,
          invocationCounts,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          common.ensureInterval,
          sinon.match.typeOf('number'),
          sinon.match.typeOf('number'),
          context,
          sinon.match.func
        );
        sinon.assert.calledWith(
          utilities.decrementConcurrencyCount,
          constants.coordinator.COMPONENT,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done
        );

        done();
      }, 20);
    });

    it('calls expected functions on increment failure', function (done) {
      sandbox.stub(console, 'error');
      utilities.incrementConcurrencyCount.yields(new Error());
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          utilities.loadArnMap,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );
        sinon.assert.calledWith(
          utilities.incrementConcurrencyCount,
          constants.coordinator.COMPONENT,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          coordinator.determineApplicationStatus,
          sinon.match.func
        );
        sinon.assert.calledWith(
          coordinator.ensureCoordinatorConcurrency,
          applicationStatus,
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          common.getInvocationCounts,
          applicationStatus
        );
        sinon.assert.calledWith(
          common.invokeApplicationLambdaFunctions,
          invocationCounts,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          common.ensureInterval,
          sinon.match.typeOf('number'),
          sinon.match.typeOf('number'),
          context,
          sinon.match.func
        );
        sinon.assert.notCalled(utilities.decrementConcurrencyCount);
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done
        );

        done();
      }, 20);
    });

    it('fails immediately on loadArnMap failure', function (done) {
      sandbox.stub(console, 'error');
      utilities.loadArnMap.yields(new Error());
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledOnce(console.error);
        sinon.assert.notCalled(utilities.incrementConcurrencyCount);
        sinon.assert.notCalled(utilities.decrementConcurrencyCount);
        sinon.assert.notCalled(utilities.invoke);
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });

    it('still calls invoke on determineApplicationStatus failure', function (done) {
      sandbox.stub(console, 'error');
      coordinator.determineApplicationStatus.yields(new Error());
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledOnce(console.error);
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });

    it('still calls invoke on ensureCoordinatorConcurrency failure', function (done) {
      sandbox.stub(console, 'error');
      coordinator.ensureCoordinatorConcurrency.yields(new Error());
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledOnce(console.error);
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });

    it('still invokes invoke on invokeApplicationLambdaFunctions failure', function (done) {
      sandbox.stub(console, 'error');
      common.invokeApplicationLambdaFunctions.yields(new Error());
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledOnce(console.error);
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });

    it('still invokes invoke on ensureInterval failure', function (done) {
      sandbox.stub(console, 'error');
      common.ensureInterval.yields(new Error());
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledOnce(console.error);
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });

    it('still calls invoke and context.done with error on decrement failure', function (done) {
      sandbox.stub(console, 'error');
      utilities.decrementConcurrencyCount.yields(new Error());
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledOnce(console.error);
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          incrementedEvent,
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });

    it('still calls context.done with error on invoke failure', function (done) {
      sandbox.stub(console, 'error');
      utilities.invoke.yields(new Error());
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledOnce(console.error);
        sinon.assert.calledWith(
          context.done,
          sinon.match.instanceOf(Error)
        );

        done();
      }, 20);
    });

    it('correctly increments higher generation count', function (done) {
      event = {
        generation: 1200
      };
      coordinator.handler(event, context);

      setTimeout(function () {
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          {
            generation: 1201
          },
          sinon.match.func
        );
        sinon.assert.calledWith(
          context.done
        );

        done();
      }, 20);
    });

  });

});
