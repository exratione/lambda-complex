/**
 * @fileOverview Tests for lib/build/configValidator.
 */

// Local.
var constants = require('../../../lib/shared/constants');
var validator = require('../../../lib/build/configValidator');


describe('lib/build/configValidator', function () {
  var exampleApplicationConfig;
  var mockApplicationConfig;
  var simpleApplicationConfig;

  beforeEach(function () {
    exampleApplicationConfig = require('../../../examples/exampleApplicationConfig');
    mockApplicationConfig = require('../../resources/mockApplication/applicationConfig');
    simpleApplicationConfig = require('../../../examples/simple/applicationConfig');
  });

  afterEach(function () {
    delete require.cache[require.resolve('../../../examples/exampleApplicationConfig')];
    delete require.cache[require.resolve('../../resources/mockApplication/applicationConfig')];
    delete require.cache[require.resolve('../../../examples/simple/applicationConfig')];
  });

  describe('validates specific incorrect configuration values', function () {
    it('returns errors on missing config', function () {
      var errors = validator.validate();
      expect(errors.length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty name', function () {
      mockApplicationConfig.name = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.name = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.name;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty version', function () {
      mockApplicationConfig.version = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.version = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.version;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty deployId', function () {
      mockApplicationConfig.deployId = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployId = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.deployId;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty deployment.region', function () {
      mockApplicationConfig.deployment.region = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployment.region = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.deployment.region;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty deployment.s3Bucket', function () {
      mockApplicationConfig.deployment.s3Bucket = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployment.s3Bucket = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.deployment.s3Bucket;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty deployment.s3KeyPrefix', function () {
      mockApplicationConfig.deployment.s3KeyPrefix = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployment.s3KeyPrefix = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.deployment.s3KeyPrefix;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on invalid deployment.tags', function () {
      mockApplicationConfig.deployment.tags = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployment.tags = {
        tagName: {}
      };
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('permits missing deployment.tags', function () {
      delete mockApplicationConfig.deployment.tags;
      expect(validator.validate(mockApplicationConfig).length).to.equal(0);
    });

    it('errors on invalid deployment.switchoverFunction', function () {
      mockApplicationConfig.deployment.switchoverFunction = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployment.switchoverFunction = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('permits missing deployment.switchoverFunction', function () {
      delete mockApplicationConfig.deployment.switchoverFunction;
      expect(validator.validate(mockApplicationConfig).length).to.equal(0);
    });

    it('errors on invalid deployment.skipPriorCloudFormationStackDeletion', function () {
      mockApplicationConfig.deployment.skipPriorCloudFormationStackDeletion = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployment.skipPriorCloudFormationStackDeletion = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('permits missing deployment.skipPriorCloudFormationStackDeletion', function () {
      delete mockApplicationConfig.deployment.skipPriorCloudFormationStackDeletion;
      expect(validator.validate(mockApplicationConfig).length).to.equal(0);
    });

    it('errors on invalid deployment.skipPriorCloudWatchLogGroupsDeletion', function () {
      mockApplicationConfig.deployment.skipPriorCloudWatchLogGroupsDeletion = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployment.skipPriorCloudWatchLogGroupsDeletion = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('permits missing deployment.skipPriorCloudWatchLogGroupsDeletion', function () {
      delete mockApplicationConfig.deployment.skipPriorCloudWatchLogGroupsDeletion;
      expect(validator.validate(mockApplicationConfig).length).to.equal(0);
    });

    it('errors on invalid deployment.skipCloudFormationStackDeletionOnFailure', function () {
      mockApplicationConfig.deployment.skipCloudFormationStackDeletionOnFailure = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.deployment.skipCloudFormationStackDeletionOnFailure = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('permits missing deployment.skipCloudFormationStackDeletionOnFailure', function () {
      delete mockApplicationConfig.deployment.skipCloudFormationStackDeletionOnFailure;
      expect(validator.validate(mockApplicationConfig).length).to.equal(0);
    });

    it('errors on invalid coordinator.coordinatorConcurrency', function () {
      mockApplicationConfig.coordinator.coordinatorConcurrency = 0;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.coordinatorConcurrency = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.coordinatorConcurrency = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on invalid coordinator.maxApiConcurrency', function () {
      mockApplicationConfig.coordinator.maxApiConcurrency = 0;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.maxApiConcurrency = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.maxApiConcurrency = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on invalid coordinator.maxInvocationCount', function () {
      mockApplicationConfig.coordinator.maxInvocationCount = 0;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.maxInvocationCount = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.maxInvocationCount = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on invalid coordinator.minInterval', function () {
      mockApplicationConfig.coordinator.minInterval = -1;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.minInterval = constants.lambda.MAX_TIMEOUT + 1;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.minInterval = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.coordinator.minInterval = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on invalid, missing, or empty roles', function () {
      mockApplicationConfig.roles = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles = [];
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.roles;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on duplicate role name', function () {
      mockApplicationConfig.roles[1].name = mockApplicationConfig.roles[0].name;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty role name', function () {
      mockApplicationConfig.roles[1].name = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles[1].name = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.roles[1].name;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('permits empty role statements', function () {
      mockApplicationConfig.roles[1].statements = [];
      expect(validator.validate(mockApplicationConfig).length).to.equal(0);
    });

    it('errors on missing, invalid, or empty role statement effect', function () {
      mockApplicationConfig.roles[1].statements[0].effect = 'invalid';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles[1].statements[0].effect = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.roles[1].statements[0].effect;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty role statement action', function () {
      mockApplicationConfig.roles[1].statements[0].action = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles[1].statements[0].action = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles[1].statements[0].action = [];
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles[1].statements[0].action = [{}];
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.roles[1].statements[0].action;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty role statement resource', function () {
      mockApplicationConfig.roles[1].statements[0].resource = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles[1].statements[0].resource = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles[1].statements[0].resource = [];
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.roles[1].statements[0].resource = [{}];
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.roles[1].statements[0].resource;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on invalid, empty, or missing components', function () {
      mockApplicationConfig.components = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components = [];
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.components;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on duplicate component name', function () {
      mockApplicationConfig.components[1].name = mockApplicationConfig.components[0].name;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on setting component name the same as an internal component name', function () {
      mockApplicationConfig.components[1].name = constants.coordinator.NAME;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].name = constants.invoker.NAME;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty component name', function () {
      mockApplicationConfig.components[1].name = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].name = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.components[1].name;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty component type', function () {
      mockApplicationConfig.components[1].type = 'invalid';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].type = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.components[1].type;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty component maxConcurrency', function () {
      mockApplicationConfig.components[0].maxConcurrency = 0;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].maxConcurrency = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].maxConcurrency = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.components[0].maxConcurrency;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty component queueWaitTime', function () {
      mockApplicationConfig.components[0].queueWaitTime = -1;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].queueWaitTime = constants.lambda.MAX_TIMEOUT + 1;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].queueWaitTime = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].queueWaitTime = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.components[0].queueWaitTime;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on specifying routing component name that is valid but not defined', function () {
      mockApplicationConfig.components[1].routing = 'wouldbevalid';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].routing = ['A', 'B'];
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty lambda.npmPackage', function () {
      mockApplicationConfig.components[1].lambda.npmPackage = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].lambda.npmPackage = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.components[1].lambda.npmPackage;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on specifying invalid lambda.handler', function () {
      mockApplicationConfig.components[1].lambda.handler = 'invalid';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].lambda.handler = null;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].lambda.handler = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on specifying reserved lambda.handler function name', function () {
      mockApplicationConfig.components[1].lambda.handler = 'index.lc';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty lambda.memorySize', function () {
      mockApplicationConfig.components[0].lambda.memorySize = constants.lambda.MIN_MEMORY_SIZE - 1;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].lambda.memorySize = constants.lambda.MAX_MEMORY_SIZE + 1;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].lambda.memorySize = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].lambda.memorySize = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.components[0].lambda.memorySize;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on missing, invalid, or empty lambda.timeout', function () {
      mockApplicationConfig.components[0].lambda.timeout = constants.lambda.MIN_TIMEOUT - 1;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].lambda.timeout = constants.lambda.MAX_TIMEOUT + 1;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].lambda.timeout = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[0].lambda.timeout = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      delete mockApplicationConfig.components[0].lambda.timeout;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on specifying invalid lambda.role', function () {
      mockApplicationConfig.components[1].lambda.role = '';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].lambda.role = null;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
      mockApplicationConfig.components[1].lambda.role = {};
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('errors on specifying lambda.role that is valid but not defined', function () {
      mockApplicationConfig.components[1].lambda.role = 'wouldbevalid';
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });
  });

  describe('validation fails for additional undefined properties', function () {
    it('top level', function () {
      mockApplicationConfig.x = true;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('deployment', function () {
      mockApplicationConfig.deployment.x = true;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('coordinator', function () {
      mockApplicationConfig.coordinator.x = true;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('role', function () {
      mockApplicationConfig.roles[0].x = true;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('role statements', function () {
      mockApplicationConfig.roles[1].statements[0].x = true;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('component', function () {
      mockApplicationConfig.components[0].x = true;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });

    it('component.lambda', function () {
      mockApplicationConfig.components[0].lambda.x = true;
      expect(validator.validate(mockApplicationConfig).length).to.be.above(0);
    });
  });

  // Run the checks on whether validation works for valid files after all the
  // tests that alter configuration. This ensures that nothing was messed up in
  // the course of testing.
  describe('validates valid configuration objects', function () {
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
  });
});
