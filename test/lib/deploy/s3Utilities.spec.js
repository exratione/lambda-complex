/**
 * @fileOverview Tests for lib/deploy/s3Utilities.
 */

var common = require('../../../lib/build/common');
var s3Utilities = require('../../../lib/deploy/s3Utilities');
var utilities = require('../../../lib/shared/utilities');

var resources = require('../../resources');
var applicationConfig = require('../../resources/mockApplication/applicationConfig');

describe('lib/deploy/s3Utilities', function () {

  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    // Make sure the relevant methods on the S3 client are stubbed.
    sandbox.stub(s3Utilities.s3Client, 'putObject').yields();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('uploadLambdaFunction', function () {
    var component;

    beforeEach(function () {
      component = applicationConfig.components[0];
    });

    it('correctly invokes the client function', function (done) {
      s3Utilities.uploadLambdaFunction(component, applicationConfig, function (error) {
        sinon.assert.calledOnce(s3Utilities.s3Client.putObject);
        sinon.assert.calledWith(
          s3Utilities.s3Client.putObject,
          {
            // Should be a read stream.
            Body: sinon.match.object,
            Bucket: applicationConfig.deployment.s3Bucket,
            Key: common.getComponentS3Key(component, applicationConfig)
          },
          sinon.match.func
        );

        done(error);
      });
    });

    it('retries on failure', function (done) {
      s3Utilities.s3Client.putObject.onCall(0).yields(new Error());

      s3Utilities.uploadLambdaFunction(component, applicationConfig, function (error) {
        sinon.assert.calledTwice(s3Utilities.s3Client.putObject);
        sinon.assert.calledWith(
          s3Utilities.s3Client.putObject,
          {
            // Should be a read stream.
            Body: sinon.match.object,
            Bucket: applicationConfig.deployment.s3Bucket,
            Key: common.getComponentS3Key(component, applicationConfig)
          },
          sinon.match.func
        );

        done(error);
      });
    });

  });

  describe('uploadArnMap', function () {
    var arnMap;

    beforeEach(function () {
      arnMap = {};
    });

    it('correctly invokes the client function', function (done) {
      s3Utilities.uploadArnMap(arnMap, applicationConfig, function (error) {
        sinon.assert.calledOnce(s3Utilities.s3Client.putObject);
        sinon.assert.calledWith(
          s3Utilities.s3Client.putObject,
          {
            Body: JSON.stringify(arnMap),
            Bucket: applicationConfig.deployment.s3Bucket,
            ContentType: 'application/json',
            Key: utilities.getArnMapS3Key(applicationConfig)
          },
          sinon.match.func
        );

        done(error);
      });
    });

    it('retries on failure', function (done) {
      s3Utilities.s3Client.putObject.onCall(0).yields(new Error());

      s3Utilities.uploadArnMap(arnMap, applicationConfig, function (error) {
        sinon.assert.calledTwice(s3Utilities.s3Client.putObject);
        sinon.assert.calledWith(
          s3Utilities.s3Client.putObject,
          {
            Body: JSON.stringify(arnMap),
            Bucket: applicationConfig.deployment.s3Bucket,
            ContentType: 'application/json',
            Key: utilities.getArnMapS3Key(applicationConfig)
          },
          sinon.match.func
        );

        done(error);
      });
    });

  });

  describe('uploadLambdaFunctions', function () {
    it('functions correctly', function (done) {
      sandbox.stub(s3Utilities, 'uploadLambdaFunction').yields();

      s3Utilities.uploadLambdaFunctions(applicationConfig, function (error) {
        sinon.assert.callCount(s3Utilities.uploadLambdaFunction, 4);
        sinon.assert.alwaysCalledWith(
          s3Utilities.uploadLambdaFunction,
          // A component; these functions run concurrently, so can't easily
          // specify which component per call.
          sinon.match.object,
          resources.getConfigMatcher(applicationConfig),
          sinon.match.func
        );

        done(error);
      });
    });
  });
});
