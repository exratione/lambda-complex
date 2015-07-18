/**
 * @fileOverview Tests for the top level index.js interface.
 */

// NPM.
var fs = require('fs-extra');

// Local.
var applicationConfigValidator = require('../lib/build/configValidator');
var common = require('../lib/build/common');
var cloudFormationTemplateUtilities = require('../lib/build/cloudFormationTemplateUtilities');
var cloudFormationUtilities = require('../lib/deploy/cloudFormationUtilities');
var installUtilities = require('../lib/build/installUtilities');
var packageUtilities = require('../lib/build/packageUtilities');
var s3Utilities = require('../lib/deploy/s3Utilities');

var applicationConfig = require('./resources/mockApplication/applicationConfig');
var index = require('../index');

describe('index', function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(applicationConfigValidator, 'validate').returns([]);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('build', function () {

    beforeEach(function () {
      sandbox.stub(fs, 'remove').yields();
      sandbox.stub(installUtilities, 'installLambdaFunctions').yields();
      sandbox.stub(packageUtilities, 'packageLambdaFunctions').yields();
      sandbox.stub(cloudFormationTemplateUtilities, 'generateTemplate').yields();
    });

    it('calls underlying functions', function (done) {
      index.build(applicationConfig, function (error) {
        sinon.assert.callOrder(
          applicationConfigValidator.validate,
          fs.remove,
          installUtilities.installLambdaFunctions,
          packageUtilities.packageLambdaFunctions,
          cloudFormationTemplateUtilities.generateTemplate
        );

        sinon.assert.calledWith(
          applicationConfigValidator.validate,
          applicationConfig
        );
        sinon.assert.calledWith(
          fs.remove,
          common.getApplicationBuildDirectory(applicationConfig),
          sinon.match.func
        );
        sinon.assert.calledWith(
          installUtilities.installLambdaFunctions,
          applicationConfig,
          sinon.match.func
        );
        sinon.assert.calledWith(
          packageUtilities.packageLambdaFunctions,
          applicationConfig,
          sinon.match.func
        );
        sinon.assert.calledWith(
          cloudFormationTemplateUtilities.generateTemplate,
          applicationConfig,
          sinon.match.func
        );

        done(error);
      });
    });
  });

  describe('deploy', function () {
    var results;

    beforeEach(function () {
      results = {};

      sandbox.stub(s3Utilities, 'uploadLambdaFunctions').yields();
      sandbox.stub(cloudFormationUtilities, 'deployStack').yields(null, results);
    });

    it('calls underlying functions', function (done) {
      index.deploy(applicationConfig, function (error, obtainedResults) {
        expect(obtainedResults).to.equal(results);

        sinon.assert.callOrder(
          applicationConfigValidator.validate,
          s3Utilities.uploadLambdaFunctions,
          cloudFormationUtilities.deployStack
        );

        sinon.assert.calledWith(
          applicationConfigValidator.validate,
          applicationConfig
        );
        sinon.assert.calledWith(
          s3Utilities.uploadLambdaFunctions,
          applicationConfig,
          sinon.match.func
        );
        sinon.assert.calledWith(
          cloudFormationUtilities.deployStack,
          applicationConfig,
          sinon.match.func
        );

        done(error);
      });
    });
  });

});
