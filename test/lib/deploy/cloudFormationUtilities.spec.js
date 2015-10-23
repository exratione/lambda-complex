/**
 * @fileOverview Tests for lib/deploy/cloudFormationUtilities.
 */

// NPM.
var cloudFormationDeploy = require('cloudformation-deploy');
var fs = require('fs-extra');

// Local.
var common = require('../../../lib/build/common');
var constants = require('../../../lib/shared/constants');
var s3Utilities = require('../../../lib/deploy/s3Utilities');
var utilities = require('../../../lib/shared/utilities');

var resources = require('../../resources');

describe('lib/deploy/cloudFormationUtilities', function () {

  var applicationConfig;
  var clock;
  var cloudFormationUtilities;
  var sandbox;

  beforeEach(function () {
    applicationConfig = require('../../resources/mockApplication/applicationConfig');

    sandbox = sinon.sandbox.create();
    clock = sandbox.useFakeTimers();
    // Load after creating the clock so that we get the fake timers.
    cloudFormationUtilities = require('../../../lib/deploy/cloudFormationUtilities');

    sandbox.stub(utilities, 'applicationConfirmationExists').yields(null, true);
  });

  afterEach(function () {
    sandbox.restore();
    delete require.cache[require.resolve('../../../lib/deploy/cloudFormationUtilities')];
    delete require.cache[require.resolve('../../resources/mockApplication/applicationConfig')];
  });

  describe('arnMapFromOutputs', function () {
    it('functions correctly', function (done) {
      var outputs = [
        {
          OutputKey: 'key1',
          OutputValue: 'value1'
        },
        {
          OutputKey: 'key2',
          OutputValue: 'value2'
        },
      ];

      cloudFormationUtilities.arnMapFromOutputs(outputs, function (error, arnMap) {
        expect(arnMap).to.eql({
          key1: 'value1',
          key2: 'value2'
        });
        done(error);
      });
    });

    it('errors on empty outputs', function (done) {
      var outputs = [];

      cloudFormationUtilities.arnMapFromOutputs(outputs, function (error, arnMap) {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });

    it('errors on undefined outputs', function (done) {
      var outputs = undefined;

      cloudFormationUtilities.arnMapFromOutputs(outputs, function (error, arnMap) {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
  });

  describe('startApplication', function () {
    var arnMap;
    var event;

    beforeEach(function () {
      arnMap = resources.getMockArnMap(applicationConfig);
      event = {};

      sandbox.stub(utilities, 'invoke').yields();
    });

    it('functions as expected', function (done) {
      cloudFormationUtilities.startApplication(arnMap, applicationConfig, function (error) {
        sinon.assert.callCount(
          utilities.invoke,
          applicationConfig.coordinator.coordinatorConcurrency
        );
        sinon.assert.calledWith(
          utilities.invoke,
          coordinatorArn = utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          event,
          sinon.match.func
        );

        done(error);
      });

      clock.tick(applicationConfig.coordinator.minInterval * 1000);
    });

    it('functions as expected when coordinatorConcurrency = 1', function (done) {
      var coordinatorConcurrency = applicationConfig.coordinator.coordinatorConcurrency;
      applicationConfig.coordinator.coordinatorConcurrency = 1;

      cloudFormationUtilities.startApplication(arnMap, applicationConfig, function (error) {
        sinon.assert.callCount(
          utilities.invoke,
          applicationConfig.coordinator.coordinatorConcurrency
        );
        sinon.assert.calledWith(
          utilities.invoke,
          coordinatorArn = utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          event,
          sinon.match.func
        );

        applicationConfig.coordinator.coordinatorConcurrency = coordinatorConcurrency;

        done(error);
      });

      clock.tick(applicationConfig.coordinator.minInterval * 1000);
    });
  });

  describe('awaitApplicationConfirmation', function () {

    it('functions correctly', function (done) {
      utilities.applicationConfirmationExists.onCall(0).yields(null, false);
      cloudFormationUtilities.awaitApplicationConfirmation(applicationConfig, function (error) {
        sinon.assert.calledTwice(utilities.applicationConfirmationExists);
        sinon.assert.alwaysCalledWith(
          utilities.applicationConfirmationExists,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );

        done(error);
      });

      clock.tick(4000);
    });

    it('calls back with error', function (done) {
      utilities.applicationConfirmationExists.yields(new Error());
      cloudFormationUtilities.awaitApplicationConfirmation(applicationConfig, function (error) {
        expect(error).to.be.instanceOf(Error);

        sinon.assert.calledOnce(utilities.applicationConfirmationExists);
        sinon.assert.alwaysCalledWith(
          utilities.applicationConfirmationExists,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );

        done();
      });

      clock.tick(2000);
    });

    it('times out', function (done) {
      utilities.applicationConfirmationExists.yields(null, false);
      cloudFormationUtilities.awaitApplicationConfirmation(applicationConfig, function (error) {
        expect(error).to.be.instanceOf(Error);

        sinon.assert.alwaysCalledWith(
          utilities.applicationConfirmationExists,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );

        done();
      });

      clock.tick((applicationConfig.coordinator.minInterval + 1) * 2 * 1000);
    });
  });

  describe('getSwitchoverFunction', function () {
    var arnMap;
    var stackDescription;
    var switchoverFn;

    beforeEach(function () {
      stackDescription = {
        Outputs: [
          {
            OutputKey: 'a',
            OutputValue: 'b',
            Description: 'c'
          }
        ]
      };
      arnMap = {
        a: 'b'
      };

      sandbox.stub(s3Utilities, 'uploadArnMap').yields();
      sandbox.stub(cloudFormationUtilities, 'startApplication').yields();
      sandbox.stub(cloudFormationUtilities, 'awaitApplicationConfirmation').yields();
      sandbox.stub(applicationConfig.deployment, 'switchoverFunction').yields();

      switchoverFn = cloudFormationUtilities.getSwitchoverFunction(
        applicationConfig,
        applicationConfig.deploymentswitchoverFunction
      );
    });

    function checkCalls () {
      sinon.assert.calledWith(
        s3Utilities.uploadArnMap,
        arnMap,
        resources.getConfigMatcher(applicationConfig),
        sinon.match.func
      );
      sinon.assert.calledWith(
        cloudFormationUtilities.startApplication,
        arnMap,
        resources.getConfigMatcher(applicationConfig),
        sinon.match.func
      );
      sinon.assert.calledWith(
        cloudFormationUtilities.awaitApplicationConfirmation,
        resources.getConfigMatcher(applicationConfig),
        sinon.match.func
      );
      sinon.assert.calledWith(
        applicationConfig.deployment.switchoverFunction,
        stackDescription,
        resources.getConfigMatcher(applicationConfig),
        sinon.match.func
      );
      sinon.assert.callOrder(
        s3Utilities.uploadArnMap,
        cloudFormationUtilities.startApplication,
        cloudFormationUtilities.awaitApplicationConfirmation,
        applicationConfig.deployment.switchoverFunction
      );
    }

    it('creates function that behaves correctly', function (done) {
      switchoverFn(stackDescription, function (error) {
        checkCalls();
        done(error);
      });

      clock.tick(applicationConfig.coordinator.minInterval * 2 * 1000);
    });

    it('creates function that behaves correctly when minInterval = 0', function (done) {
      var minInterval = applicationConfig.coordinator.minInterval;
      applicationConfig.coordinator.minInterval = 0;

      switchoverFn(stackDescription, function (error) {
        checkCalls();
        applicationConfig.coordinator.minInterval = minInterval;
        done(error);
      });
    });

    it('creates function that behaves correctly when coordinatorConcurrency = 1', function (done) {
      var coordinatorConcurrency = applicationConfig.coordinator.coordinatorConcurrency;
      applicationConfig.coordinator.coordinatorConcurrency = 1;

      switchoverFn(stackDescription, function (error) {
        checkCalls();
        applicationConfig.coordinator.coordinatorConcurrency = coordinatorConcurrency;
        done(error);
      });
    });

    it('works when user switchover function is not a function', function (done) {
      var fn = applicationConfig.deployment.switchoverFunction;
      applicationConfig.deployment.switchoverFunction = undefined;

      switchoverFn(stackDescription, function (error) {
        sinon.assert.calledWith(
          s3Utilities.uploadArnMap,
          arnMap,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );
        sinon.assert.calledWith(
          cloudFormationUtilities.startApplication,
          arnMap,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );
        sinon.assert.calledWith(
          cloudFormationUtilities.awaitApplicationConfirmation,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );

        // Put it back the way it was.
        applicationConfig.deployment.switchoverFunction = fn;

        done(error);
      });
    });

    it('skips user switchover function on uploadArnMap error', function (done) {
      s3Utilities.uploadArnMap.yields(new Error());

      switchoverFn(stackDescription, function (error) {
        expect(error).to.be.instanceOf(Error);
        sinon.assert.notCalled(applicationConfig.deployment.switchoverFunction);

        done();
      });
    });

    it('skips user switchover function on startApplication error', function (done) {
      cloudFormationUtilities.startApplication.yields(new Error());

      switchoverFn(stackDescription, function (error) {
        expect(error).to.be.instanceOf(Error);
        sinon.assert.notCalled(applicationConfig.deployment.switchoverFunction);

        done();
      });
    });

    it('skips user switchover function on awaitApplicationConfirmation error', function (done) {
      cloudFormationUtilities.awaitApplicationConfirmation.yields(new Error());

      switchoverFn(stackDescription, function (error) {
        expect(error).to.be.instanceOf(Error);
        sinon.assert.notCalled(applicationConfig.deployment.switchoverFunction);

        done();
      });
    });

  });

  describe('generateCloudFormationDeployConfig', function () {

    it('creates correct configuration object', function () {
      var obj = cloudFormationUtilities.generateCloudFormationDeployConfig(
        applicationConfig
      );

      // Check the function.
      expect(obj.postCreationFn).to.be.a('function');
      delete obj.postCreationFn;

      // Compare the rest.
      expect(obj).to.eql({
        baseName: applicationConfig.name,
        version: applicationConfig.version,
        deployId: applicationConfig.deployId,
        createStackTimeoutInMinutes: 10,
        tags: applicationConfig.deployment.tags,
        progressCheckIntervalInSeconds: 10,
        priorInstance: cloudFormationDeploy.priorInstance.DELETE,
        onFailure: cloudFormationDeploy.onFailure.DELETE
      });
    });

    it('creates correct configuration object for skipPriorCloudFormationStackDeletion', function () {
      applicationConfig.deployment.skipPriorCloudFormationStackDeletion = true;
      var obj = cloudFormationUtilities.generateCloudFormationDeployConfig(
        applicationConfig
      );

      // Check the function.
      expect(obj.postCreationFn).to.be.a('function');
      delete obj.postCreationFn;

      // Compare the rest.
      expect(obj).to.eql({
        baseName: applicationConfig.name,
        version: applicationConfig.version,
        deployId: applicationConfig.deployId,
        createStackTimeoutInMinutes: 10,
        tags: applicationConfig.deployment.tags,
        progressCheckIntervalInSeconds: 10,
        priorInstance: cloudFormationDeploy.priorInstance.DO_NOTHING,
        onFailure: cloudFormationDeploy.onFailure.DELETE
      });
    });

    it('creates correct configuration object for skipCloudFormationStackDeletionOnFailure', function () {
      applicationConfig.deployment.skipCloudFormationStackDeletionOnFailure = true;
      var obj = cloudFormationUtilities.generateCloudFormationDeployConfig(
        applicationConfig
      );

      // Check the function.
      expect(obj.postCreationFn).to.be.a('function');
      delete obj.postCreationFn;

      // Compare the rest.
      expect(obj).to.eql({
        baseName: applicationConfig.name,
        version: applicationConfig.version,
        deployId: applicationConfig.deployId,
        createStackTimeoutInMinutes: 10,
        tags: applicationConfig.deployment.tags,
        progressCheckIntervalInSeconds: 10,
        priorInstance: cloudFormationDeploy.priorInstance.DELETE,
        onFailure: cloudFormationDeploy.onFailure.DO_NOTHING
      });
    });
  });

  describe('deployStack', function () {
    var cloudFormationDeployConfig;
    var results;
    var template;

    beforeEach(function () {
      cloudFormationDeployConfig = {};
      results = {};
      template = JSON.stringify({});

      sandbox.stub(
        cloudFormationUtilities,
        'generateCloudFormationDeployConfig'
      ).returns(cloudFormationDeployConfig);

      sandbox.stub(fs, 'readFile').yields(null, template);
      sandbox.stub(cloudFormationDeploy, 'deploy').yields(null, results);
    });

    it('functions correctly', function (done) {
      cloudFormationUtilities.deployStack(applicationConfig, function (error, obtainedResults) {
        expect(obtainedResults).to.equal(results);

        sinon.assert.calledWith(
          fs.readFile,
          common.getCloudFormationTemplatePath(applicationConfig),
          {
            encoding: 'utf8'
          },
          sinon.match.func
        );

        sinon.assert.calledWith(
          cloudFormationDeploy.deploy,
          cloudFormationDeployConfig,
          template,
          sinon.match.func
        );

        done(error);
      });
    });

    it('calls back with error on read file error', function (done) {
      fs.readFile.yields(new Error());

      cloudFormationUtilities.deployStack(applicationConfig, function (error) {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });

    it('calls back with error on deploy error', function (done) {
      cloudFormationDeploy.deploy.yields(new Error());

      cloudFormationUtilities.deployStack(applicationConfig, function (error) {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });

  });

});
