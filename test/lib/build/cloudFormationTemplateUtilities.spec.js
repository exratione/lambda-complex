/**
 * @fileOverview Tests for lib/build/cloudFormationTemplateUtilities.
 */

// Core.
var path = require('path');

// Local.
var cloudFormationTemplateUtilities = require('../../../lib/build/cloudFormationTemplateUtilities');
var constants = require('../../../lib/shared/constants');
var resources = require('../../resources');
var applicationConfig = require('../../resources/mockApplication/applicationConfig');

describe('lib/build/cloudFormationTemplateUtilities', function () {
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
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getAllRoles', function () {
    it('functions correctly', function () {
      expect(cloudFormationTemplateUtilities.getAllRoles(applicationConfig)).to.eql([
        {
          name: constants.coordinator.ROLE,
          statements: []
        }
      ].concat(applicationConfig.roles));
    })
  });

  describe('generateTemplate', function () {
    it('produces the correct CloudFormation template', function () {
      // The template for the mock app will already have been generated via
      // this function, so load it and compare with the expected one.
      var actual = require(path.resolve(
        __dirname,
        '../..',
        resources.getScratchDirectory(),
        applicationConfig.name,
        'cloudFormation'
      ));
      var expected = resources.getExpectedCloudFormationTemplate();

      expect(actual).to.eql(expected);
    })
  });

});
