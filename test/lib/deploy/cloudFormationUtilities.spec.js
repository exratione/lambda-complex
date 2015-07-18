/**
 * @fileOverview Tests for lib/deploy/cloudFormationUtilities.
 */

// NPM.
var cloudFormationDeploy = require('cloudformation-deploy');
var fs = require('fs-extra');

// Local.
var common = require('../../../lib/build/common');
var constants = require('../../../lib/shared/constants');
var cloudFormationUtilities = require('../../../lib/deploy/cloudFormationUtilities');
var s3Utilities = require('../../../lib/deploy/s3Utilities');
var utilities = require('../../../lib/shared/utilities');

var resources = require('../../resources');
var applicationConfig = require('../../resources/mockApplication/applicationConfig');

describe('lib/deploy/cloudFormationUtilities', function () {

  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
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

      sandbox.stub(applicationConfig.deployment, 'switchoverFunction').yields();

      switchoverFn = cloudFormationUtilities.getSwitchoverFunction(
        applicationConfig,
        applicationConfig.deploymentswitchoverFunction
      );

      sandbox.stub(s3Utilities, 'uploadArnMap').yields();
      sandbox.stub(utilities, 'invoke').yields();
    });

    it('creates function that behaves correctly', function (done) {
      switchoverFn(stackDescription, function (error) {
        sinon.assert.calledWith(
          s3Utilities.uploadArnMap,
          arnMap,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );
        sinon.assert.callCount(
          utilities.invoke,
          applicationConfig.coordinator.coordinatorConcurrency
        );
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          {},
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
          utilities.invoke,
          applicationConfig.deployment.switchoverFunction
        );

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
        sinon.assert.callCount(
          utilities.invoke,
          applicationConfig.coordinator.coordinatorConcurrency
        );
        sinon.assert.calledWith(
          utilities.invoke,
          utilities.getLambdaFunctionArn(
            constants.coordinator.NAME,
            arnMap
          ),
          {},
          sinon.match.func
        );

        // Put it back the way it was.
        applicationConfig.deployment.switchoverFunction = fn;

        done(error);
      });
    });

    it('skips user switchover function on error', function (done) {
      s3Utilities.uploadArnMap.yields(new Error());

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

    it('creates correct configuration object for dev mode', function () {
      var devMode = applicationConfig.deployment.developmentMode;
      applicationConfig.deployment.developmentMode = true;
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
        onFailure: cloudFormationDeploy.onFailure.DO_NOTHING
      });

      // Restore the original.
      applicationConfig.deployment.developmentMode = devMode;
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
