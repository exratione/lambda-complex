/**
 * @fileOverview Tests for lib/build/configValidator.
 */

// NPM.
var _ = require('lodash');

// Local.
var exampleApplicationConfig = require('../../../examples/exampleApplicationConfig');
var mockApplicationConfig = require('../../resources/mockApplication/applicationConfig');
var simpleApplicationConfig = require('../../../examples/simple/applicationConfig');
var validator = require('../../../lib/build/configValidator');

describe('lib/build/configValidator', function () {

  it('validates the example application config', function () {
    var errors = validator.validate(exampleApplicationConfig);
    expect(errors.length).to.equal(0);
  });

  it('validates the mock application config', function () {
    var errors = validator.validate(mockApplicationConfig);
    expect(errors.length).to.equal(0);
  });

  it('validates the simple application config', function () {
    var errors = validator.validate(simpleApplicationConfig);
    expect(errors.length).to.equal(0);
  });

  it('returns errors on missing config', function () {
    var errors = validator.validate();
    expect(errors.length).to.be.above(0);
  });

  describe('validates specific incorrect configuration values', function () {
    var config;

    beforeEach(function () {
      config = _.cloneDeep(mockApplicationConfig);
    });

    it('errors on missing or empty name', function () {
      config.name = '';
      expect(validator.validate(config).length).to.be.above(0);
      config.name = undefined;
      expect(validator.validate(config).length).to.be.above(0);
    });

    it('errors on missing or empty region', function () {
      config.deployment.region = '';
      expect(validator.validate(config).length).to.be.above(0);
      config.deployment.region = undefined;
      expect(validator.validate(config).length).to.be.above(0);
    });


    // TODO: fill out further when configuration finalized.


  });

});
