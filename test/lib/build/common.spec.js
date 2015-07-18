/**
 * @fileOverview Tests for lib/build/common.
 */

// Core.
var path = require('path');

// NPM.
var fs = require('fs-extra');
var _ = require('lodash');

// Local.
var buildCommon = require('../../../lib/build/common');
var constants = require('../../../lib/shared/constants');
var applicationConfig = require('../../resources/mockApplication/applicationConfig');
var resources = require('../../resources');

var scratchDir = resources.getScratchDirectory();

describe('lib/build/common', function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getApplicationBuildDirectory', function () {
    it('functions correctly', function () {
      expect(
        buildCommon.getApplicationBuildDirectory(applicationConfig)
      ).to.equal(
        path.resolve(
          __dirname,
          '../../../build',
          applicationConfig.name,
          // Might be a number, and path.resolve only wants strings.
          '' + applicationConfig.deployId
        )
      );
    });
  });

  describe('getApplicationBuildNodeModulesDirectory', function () {
    it('functions correctly', function () {
      expect(
        buildCommon.getApplicationBuildNodeModulesDirectory(applicationConfig)
      ).to.equal(
        path.resolve(
          __dirname,
          '../../../build',
          applicationConfig.name,
          // Might be a number, and path.resolve only wants strings.
          '' + applicationConfig.deployId,
          'node_modules'
        )
      );
    });
  });

  describe('getApplicationPackageDirectories', function () {
    var fakePackageDirs;
    var fakeApplicationDir;

    beforeEach(function () {
      fakeApplicationDir = path.join(scratchDir, 'fake');

      fakePackageDirs = [
        path.join(fakeApplicationDir, 'node_modules/.bin'),
        path.join(fakeApplicationDir, 'node_modules/x'),
        path.join(fakeApplicationDir, 'node_modules/y'),
        path.join(fakeApplicationDir, 'node_modules/z')
      ];

      _.each(fakePackageDirs, function (dir) {
        fs.mkdirsSync(dir);
      });

      // Changing the application build directory to the test scratch directory.
      sandbox.stub(
        buildCommon,
        'getApplicationBuildDirectory'
      ).returns(fakeApplicationDir);
    });

    it('functions correctly, ignores .bin directory', function (done) {
      buildCommon.getApplicationPackageDirectories(
        applicationConfig,
        function (error, dirs) {
          expect(error).to.not.be.instanceof(Error);
          expect(dirs).to.eql(fakePackageDirs.slice(1));
          done();
        }
      );
    });
  });

  describe('getComponentS3Key', function () {
    it('functions correctly', function () {
      expect(
        buildCommon.getComponentS3Key(
          applicationConfig.components[0],
          applicationConfig
        )
      ).to.equal(
        path.join(
          applicationConfig.deployment.s3KeyPrefix,
          applicationConfig.name,
          // Could be a number or a string, but path#join wants strings only.
          '' + applicationConfig.deployId,
          applicationConfig.components[0].name + '.zip'
        )
      );
    });
  });

  describe('getComponentZipFilePath', function () {
    it('functions correctly', function () {
      expect(
        buildCommon.getComponentZipFilePath(
          applicationConfig.components[0],
          applicationConfig
        )
      ).to.equal(
        path.join(
          buildCommon.getApplicationBuildDirectory(applicationConfig),
          applicationConfig.components[0].name + '.zip'
        )
      );
    });
  });

  describe('getCoordinatorComponentDefinition', function () {
    it('functions correctly', function () {
      expect(buildCommon.getCoordinatorComponentDefinition()).to.eql({
        name: constants.coordinator.NAME,
        type: constants.componentType.INTERNAL,
        lambda: {
          npmPackage: path.resolve(
            __dirname,
            '../../../lib/lambdaFunctions/coordinator'
          ),
          handler: constants.coordinator.HANDLE,
          memorySize: constants.coordinator.MEMORY_SIZE,
          timeout: constants.coordinator.TIMEOUT,
          role: constants.coordinator.ROLE
        }
      });
    });
  });

  describe('getInvokerComponentDefinition', function () {
    it('functions correctly', function () {
      expect(buildCommon.getInvokerComponentDefinition()).to.eql({
        name: constants.invoker.NAME,
        type: constants.componentType.INTERNAL,
        lambda: {
          // It uses a different handle in the coordinator package.
          npmPackage: path.resolve(
            __dirname,
            '../../../lib/lambdaFunctions/coordinator'
          ),
          handler: constants.invoker.HANDLE,
          memorySize: constants.invoker.MEMORY_SIZE,
          timeout: constants.invoker.TIMEOUT,
          role: constants.invoker.ROLE
        }
      });
    });
  });

  describe('getAllComponents', function () {
    it('functions correctly', function () {
      expect(buildCommon.getAllComponents(applicationConfig)).to.eql([
        buildCommon.getCoordinatorComponentDefinition(),
        buildCommon.getInvokerComponentDefinition()
      ].concat(applicationConfig.components))
    });
  });

  describe('getEventFromMessageComponents', function () {
    it('functions correctly', function () {
      expect(buildCommon.getEventFromMessageComponents(applicationConfig)).to.eql([
        applicationConfig.components[0]
      ]);
    });
  });

});
