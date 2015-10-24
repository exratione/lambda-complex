/**
 * @fileOverview Tests for lib/lambdaFunctions/coordinator/index.js.
 */

// Core.
var path = require('path');

// Local.
var applicationConfig = require('../../../resources/mockApplication/applicationConfig');
var resources = require('../../../resources');
var scratchDir = resources.getScratchDirectory();
var mockApplicationDir = path.join(scratchDir, applicationConfig.name);

describe('lib/lambdaFunctions/coordinator/coordinator', function () {
  var constants;
  var coordinator;
  var index;
  var invoker;
  var utilities;

  before(function (done) {
    // Needs time to set up the mock application as there are npm install
    // commands in there.
    this.timeout(30000);
    // Set up the mock application.
    resources.setUpMockApplication(applicationConfig, done);
  });

  beforeEach(function () {
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
    index = require(path.join(
      mockApplicationDir,
      'lambdaComplexCoordinator',
      'index'
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
  });

  it('exports expected handlers', function () {
    var coordinatorHandlerFnName = utilities.getFunctionNameFromHandle(
      constants.coordinator.HANDLER
    );
    var invokerHandlerFnName = utilities.getFunctionNameFromHandle(
      constants.invoker.HANDLER
    );

    expect(index[coordinatorHandlerFnName]).to.equal(coordinator.handler);
    expect(index[invokerHandlerFnName]).to.equal(invoker.handler);
  });
});
