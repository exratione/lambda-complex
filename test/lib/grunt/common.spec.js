/**
 * @fileOverview Tests for lib/grunt/common.
 */

// Core.
var path = require('path');

// Local.
var applicationConfig = require('../../resources/mockApplication/applicationConfig');
var gruntCommon = require('../../../lib/grunt/common');
var resources = require('../../resources');

describe('lib/grunt/common', function () {
  var grunt;
  var relativeConfigPath;
  var absoluteConfigPath;
  var sandbox;

  beforeEach(function () {
    grunt = {
      fail: {
        fatal: function () {}
      },
      option: function () {}
    };
    sandbox = sinon.sandbox.create();

    // Relative to the top level directory, which should be process.cwd() when
    // Grunt is running.
    relativeConfigPath = './test/resources/mockApplication/applicationConfig';
    absoluteConfigPath = path.resolve(process.cwd(), relativeConfigPath);

    sandbox.stub(grunt.fail, 'fatal');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getConfigurationFromOptionOrFail', function () {
    it('functions as expected for relative path', function () {
      sandbox.stub(grunt, 'option').returns(relativeConfigPath);

      var config = gruntCommon.getConfigurationFromOptionOrFail(grunt);

      sinon.assert.calledWith(grunt.option, 'config-path');

      // Hijack the Sinon matcher to make the comparison, since that is what it
      // is for.
      var matcher = resources.getConfigMatcher(applicationConfig);

      expect(matcher.test(config)).to.equal(true);
    });

    it('functions as expected for absolute path', function () {
      sandbox.stub(grunt, 'option').returns(absoluteConfigPath);

      var config = gruntCommon.getConfigurationFromOptionOrFail(grunt);

      sinon.assert.calledWith(grunt.option, 'config-path');

      // Hijack the Sinon matcher to make the comparison, since that is what it
      // is for.
      var matcher = resources.getConfigMatcher(applicationConfig);

      expect(matcher.test(config)).to.equal(true);
    });

    it('invokes grunt.fail.fatal for missing option', function () {
      sandbox.stub(grunt, 'option').returns(undefined);

      gruntCommon.getConfigurationFromOptionOrFail(grunt);

      sinon.assert.calledWith(grunt.option, 'config-path');
      sinon.assert.calledWith(grunt.fail.fatal, sinon.match.instanceOf(Error));
    });

    it('invokes grunt.fail.fatal for bad path', function () {
      sandbox.stub(grunt, 'option').returns('/no/such/path');

      gruntCommon.getConfigurationFromOptionOrFail(grunt);

      sinon.assert.calledWith(grunt.option, 'config-path');
      sinon.assert.calledWith(grunt.fail.fatal, sinon.match.instanceOf(Error));
    });
  })

});
