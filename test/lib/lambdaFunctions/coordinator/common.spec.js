/**
 * @fileOverview Tests for lib/lambdaFunctions/coordinator/common.js.
 */

// Core.
var path = require('path');

// NPM.
var _ = require('lodash');

// Local.
var resources = require('../../../resources');
var applicationConfig = require('../../../resources/mockApplication/applicationConfig');
var scratchDir = resources.getScratchDirectory();
var mockApplicationDir = path.join(scratchDir, applicationConfig.name);

describe('lib/lambdaFunctions/coordinator/common', function () {

  var arnMap;
  var common;
  var constants;
  var utilities;
  var sandbox;

  before(function (done) {
    // Needs time to set up the mock application as there are npm install
    // commands in there.
    this.timeout(30000);
    // Set up the mock application.
    resources.setUpMockApplication(applicationConfig, done);
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    arnMap = resources.getMockArnMap(applicationConfig);
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
    utilities = require(path.join(
      mockApplicationDir,
      'lambdaComplexCoordinator',
      '_utilities'
    ));
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('ensureInterval', function () {
    var clock;
    var startTime;
    var interval;
    var context;
    var calledBack;

    beforeEach(function () {
      clock = sandbox.useFakeTimers();
      calledBack = false;
    });

    it('calls back after interval if time remains', function () {
      interval = 30000;
      startTime = new Date().getTime();
      context = {
        getRemainingTimeInMillis: sandbox.stub().returns(50000)
      };

      common.ensureInterval(startTime, interval, context, function () {
        calledBack = true;
      });

      expect(calledBack).to.equal(false);
      clock.tick(interval + 100);
      expect(calledBack).to.equal(true);
    });

    it('calls back immediately if interval has already elapsed', function () {
      interval = 30000;
      startTime = new Date().getTime() - interval;
      context = {
        getRemainingTimeInMillis: sandbox.stub().returns(20000)
      };

      common.ensureInterval(startTime, interval, context, function () {
        calledBack = true;
      });

      // False immediately because we're not on to the next tick yet.
      expect(calledBack).to.equal(false);
      clock.tick(1);
      expect(calledBack).to.equal(true);
    });

    it('calls back early if too little time remains', function () {
      interval = 30000;
      startTime = new Date().getTime();
      context = {
        // Five seconds is the safety buffer; call back immediately if that is
        // all that is left.
        getRemainingTimeInMillis: sandbox.stub().returns(5000)
      };

      common.ensureInterval(startTime, interval, context, function () {
        calledBack = true;
      });

      // False immediately because we're not on to the next tick yet.
      expect(calledBack).to.equal(false);
      clock.tick(1);
      expect(calledBack).to.equal(true);
    });
  });

  describe('getAllComponents', function () {
    it('functions correctly', function () {
      expect(common.getAllComponents(applicationConfig)).to.eql([
        constants.coordinator.COMPONENT,
        constants.invoker.COMPONENT
      ].concat(applicationConfig.components))
    });
  });

  describe('executeConcurrently', function () {
    var fns;
    var calledBack;

    var noError = function (index, delay) {
      return function (callback) {
        setTimeout(function () {
          calledBack[index] = true;
          callback();
        }, delay);
      };
    };
    var withError = function (index, delay) {
      return function (callback) {
        calledBack[index] = true;
        setTimeout(function () {
          calledBack[index] = true;
          callback(new Error());
        }, delay);
      };
    };

    beforeEach(function () {
      calledBack = [
        false,
        false,
        false
      ];
      fns = [
        noError(0, 10),
        noError(1, 10),
        noError(2, 10)
      ];

      sandbox.stub(console, 'error');
    });

    it('handles empty case', function (done) {
      common.executeConcurrently([], 2, function (error) {
        expect(error).to.equal(undefined);
        sinon.assert.notCalled(console.error);
        done();
      });
    });

    it('invokes all functions', function (done) {
      common.executeConcurrently(fns, 2, function (error) {
        expect(error).to.equal(undefined);
        sinon.assert.notCalled(console.error);
        expect(calledBack).to.eql([true, true, true]);
        done();
      });
    });

    it('logs errors, still invokes all functions', function (done) {
      fns = [
        withError(0, 10),
        withError(1, 10),
        withError(2, 10)
      ];
      common.executeConcurrently(fns, 2, function (error) {
        expect(error).to.equal(undefined);
        sinon.assert.callCount(console.error, 3);
        expect(calledBack).to.eql([true, true, true]);
        done();
      });
    });
  });

  describe('getInvocationCounts', function () {
    var applicationStatus;

    beforeEach(function () {
      applicationStatus = {
        components: [
          {
            name: 'a',
            type: constants.componentType.EVENT_FROM_MESSAGE,
            concurrency: 1,
            maxConcurrency: 3,
            queuedMessageCount: 5
          },
          {
            name: 'b',
            type: constants.componentType.EVENT_FROM_INVOCATION,
            concurrency: 2,
          }
        ]
      };
    });

    it('returns invocation counts with concurrency limit', function () {
      var invocationCounts = [
        {
          name: applicationStatus.components[0].name,
          // 2 because maxConcurrency - concurrency is less than
          // queuedMessageCount.
          count: 2
        }
      ];

      expect(common.getInvocationCounts(applicationStatus)).to.eql(invocationCounts);
    });

    it('returns invocation counts with queuedMessageCount limit', function () {
      applicationStatus.components[0].maxConcurrency = 100;

      var invocationCounts = [
        {
          name: applicationStatus.components[0].name,
          // 5 because maxConcurrency - concurrency is now greater than
          // queuedMessageCount.
          count: 5
        }
      ];

      expect(common.getInvocationCounts(applicationStatus)).to.eql(invocationCounts);
    });

    it('skips null queuedMessageCount', function () {
      var invocationCounts = [];

      applicationStatus.components[0].queuedMessageCount = null;
      expect(common.getInvocationCounts(applicationStatus)).to.eql(invocationCounts);
    });

    it('skips null concurrency', function () {
      var invocationCounts = [];

      applicationStatus.components[0].concurrency = null;
      expect(common.getInvocationCounts(applicationStatus)).to.eql(invocationCounts);
    });
  });

  describe('sumOfInvocationCounts', function () {
    it('sums correctly', function () {
      var invocationCounts = [];
      expect(common.sumOfInvocationCounts(invocationCounts)).to.equal(0);

      invocationCounts = [
        { name: 'componentName', count: 10 }
      ];
      expect(common.sumOfInvocationCounts(invocationCounts)).to.equal(10);

      invocationCounts = [
        { name: 'componentName', count: 10 },
        { name: 'componentName', count: 5 }
      ];
      expect(common.sumOfInvocationCounts(invocationCounts)).to.equal(15);
    });
  });

  describe('splitInvocationCounts', function () {
    var maxInvocationCount = applicationConfig.coordinator.maxInvocationCount;
    var split;
    var invocationCounts;

    it('handles the empty case', function () {
      invocationCounts = [];
      split = {
        localInvoker: [],
        otherInvoker: []
      };

      expect(common.splitInvocationCounts(invocationCounts)).to.eql(split);
    });

    it('takes a single small count for local invocation', function () {
      invocationCounts = [
        { name: 'component1', count: maxInvocationCount }
      ];
      split = {
        localInvoker: [
          { name: 'component1', count: maxInvocationCount }
        ],
        otherInvoker: []
      };

      expect(common.splitInvocationCounts(invocationCounts)).to.eql(split);
    });

    it('takes a few small counts for local invocation', function () {
      invocationCounts = [
        { name: 'component1', count: Math.floor(maxInvocationCount / 3) },
        { name: 'component2', count: Math.floor(maxInvocationCount / 3) }
      ];
      split = {
        localInvoker: [
          { name: 'component1', count: Math.floor(maxInvocationCount / 3) },
          { name: 'component2', count: Math.floor(maxInvocationCount / 3) }
        ],
        otherInvoker: []
      };

      expect(common.splitInvocationCounts(invocationCounts)).to.eql(split);
    });

    it('splits large counts, retains small remainder for local invocation', function () {
      invocationCounts = [
        { name: 'component1', count: maxInvocationCount * 2 + 1 }
      ];
      split = {
        localInvoker: [
          { name: 'component1', count: 1 }
        ],
        otherInvoker: [
          [
            { name: 'component1', count: maxInvocationCount }
          ],
          [
            { name: 'component1', count: maxInvocationCount }
          ]
        ]
      };

      expect(common.splitInvocationCounts(invocationCounts)).to.eql(split);
    });

    it('behaves correctly at upper boundary for splitting with small remainder', function () {
      invocationCounts = [
        { name: 'component3', count: 1 },
        { name: 'component2', count: maxInvocationCount * (maxInvocationCount / 2 - 1) },
        { name: 'component1', count: maxInvocationCount * maxInvocationCount / 2 }
      ];
      split = {
        localInvoker: [
          { name: 'component3', count: 1 }
        ],
        otherInvoker: []
      };

      // The results from splitting off by chunks of maxInvocationCount.
      split.otherInvoker = _.times(maxInvocationCount / 2, function () {
        return [
          { name: 'component1', count: maxInvocationCount }
        ];
      }).concat(
        _.times(maxInvocationCount / 2 - 1, function () {
          return [
            { name: 'component2', count: maxInvocationCount }
          ];
        })
      );

      expect(common.splitInvocationCounts(invocationCounts)).to.eql(split);
    });

    it('splits large counts, sends on too-large remainder', function () {
      invocationCounts = [
        { name: 'component3', count: 2 },
        { name: 'component2', count: maxInvocationCount * (maxInvocationCount / 2 - 1) },
        { name: 'component1', count: maxInvocationCount * maxInvocationCount / 2 }
      ];
      split = {
        localInvoker: [],
        otherInvoker: []
      };

      // The results from splitting off by chunks of maxInvocationCount.
      split.otherInvoker = _.times(maxInvocationCount / 2, function () {
        return [
          { name: 'component1', count: maxInvocationCount }
        ];
      }).concat(
        _.times(maxInvocationCount / 2 - 1, function () {
          return [
            { name: 'component2', count: maxInvocationCount }
          ];
        })
      );

      // Then what is left over but too large for local invocation because we're
      // going to use up invocations on invoking other invokers.
      split.otherInvoker.push([
        { name: 'component3', count: 2 }
      ]);

      expect(common.splitInvocationCounts(invocationCounts)).to.eql(split);
    });

    it('manages many small counts correctly', function () {
      // A set of components to ensure that some have to be split, others
      // collected into one set for an invoker.
      invocationCounts = [
        { name: 'component1', count: maxInvocationCount / 2 },
        { name: 'component2', count: 1 },
        { name: 'component3', count: 2 },
        { name: 'component4', count: maxInvocationCount },
        { name: 'component5', count: 1 }
      ];
      split = {
        localInvoker: [
          { name: 'component1', count: 1 }
        ],
        otherInvoker: [
          [
            { name: 'component5', count: 1 },
            { name: 'component4', count: 5 }
          ],
          [
            { name: 'component4', count: 1 },
            { name: 'component3', count: 2 },
            { name: 'component2', count: 1 },
            { name: 'component1', count: 2 }
          ]
        ]
      };

      expect(common.splitInvocationCounts(invocationCounts)).to.eql(split);
    });
  });

  describe('invokeEventFromMessageFunction', function () {
    it('calls underlying utility method', function (done) {
      var name = applicationConfig.components[0].name;
      sandbox.stub(utilities, 'invoke').yields();

      common.invokeEventFromMessageFunction(name, arnMap, function (error) {
        expect(error).to.equal(undefined);
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(name, arnMap),
          {},
          sinon.match.func
        );

        done();
      });
    });
  });

  describe('invokeInvoker', function () {
    it('calls underlying utility method', function (done) {
      var invocationCounts = [];
      sandbox.stub(utilities, 'invoke').yields();

      common.invokeInvoker(invocationCounts, arnMap, function (error) {
        expect(error).to.equal(undefined);
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(constants.invoker.NAME, arnMap),
          {
            components: invocationCounts
          },
          sinon.match.func
        );

        done();
      });
    });
  });

  describe('invokeApplicationLambdaFunctions', function () {
    var split;

    beforeEach(function () {
      sandbox.stub(common, 'invokeInvoker').yields();
      sandbox.stub(common, 'invokeEventFromMessageFunction').yields();
      sandbox.stub(common, 'splitInvocationCounts');
      sandbox.stub(console, 'error');
    });

    it('handles empty case', function (done) {
      split = {
        localInvoker: [],
        otherInvoker: []
      };
      common.splitInvocationCounts.returns(split);

      // Doesn't matter what is passed in for data, as the stubbed return from
      // common.splitInvocationCounts is used instead.
      common.invokeApplicationLambdaFunctions([], arnMap, function (error) {
        expect(error).to.equal(undefined);
        sinon.assert.notCalled(common.invokeInvoker);
        sinon.assert.notCalled(common.invokeEventFromMessageFunction);
        sinon.assert.notCalled(console.error);
        done();
      });
    });

    it('behaves correctly for mixed data', function (done) {
      split = {
        localInvoker: [
          { name: 'component1', count: 1 },
          { name: 'component2', count: 2 }
        ],
        otherInvoker: [
          [
            { name: 'component5', count: 1 },
            { name: 'component4', count: 5 }
          ],
          [
            { name: 'component4', count: 1 },
            { name: 'component3', count: 2 },
            { name: 'component2', count: 1 },
            { name: 'component1', count: 2 }
          ]
        ]
      };
      common.splitInvocationCounts.returns(split);

      // Doesn't matter what is passed in for data, as the stubbed return from
      // common.splitInvocationCounts is used instead.
      common.invokeApplicationLambdaFunctions([], arnMap, function (error) {
        expect(error).to.equal(undefined);
        sinon.assert.callCount(common.invokeInvoker, 2);
        sinon.assert.calledWith(
          common.invokeInvoker,
          split.otherInvoker[0],
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          common.invokeInvoker,
          split.otherInvoker[1],
          arnMap,
          sinon.match.func
        );

        sinon.assert.callCount(common.invokeEventFromMessageFunction, 3);
        sinon.assert.calledWith(
          common.invokeEventFromMessageFunction,
          split.localInvoker[0].name,
          arnMap,
          sinon.match.func
        );
        sinon.assert.calledWith(
          common.invokeEventFromMessageFunction,
          split.localInvoker[1].name,
          arnMap,
          sinon.match.func
        );

        sinon.assert.notCalled(console.error);
        done();
      });
    });

  });

});
