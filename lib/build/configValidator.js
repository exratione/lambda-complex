/**
 * @fileOverview A configuration validator.
 */

// Core.
var util = require('util');

// NPM.
var jsonschema = require('jsonschema');
var jsonschemaHelpers = require('jsonschema/lib/helpers');
var _ = require('lodash');

// Local.
var constants = require('../shared/constants');

// --------------------------------------------------------------------------
// Schema definitions.
// --------------------------------------------------------------------------

var configSchema = {
  id: '/Config',
  type: 'object',
  properties: {
    components: {
      type: 'array',
      items: {
        anyOf: [
          {
            $ref: '/EventFromMessageComponent'
          },
          {
            $ref: '/EventFromInvocationComponent'
          }
        ]
      },
      minItems: 1,
      noDuplicatePropertyValuesFor: ['name'],
      required: true
    },
    coordinator: {
      $ref: '/Coordinator',
      required: true
    },
    deployId: {
      anyOf: [
        {
          type: 'string',
          pattern: /[a-z0-9]+/i
        },
        {
          type: 'number',
          minimum: 0
        }
      ],
      required: true
    },
    deployment: {
      $ref: '/Deployment',
      required: true
    },
    name: {
      type: 'string',
      pattern: /[a-z0-9]+/i,
      required: true
    },
    roles: {
      type: 'array',
      items: {
        $ref: '/Role'
      },
      minItems: 1,
      noDuplicatePropertyValuesFor: ['name'],
      required: true
    },
    version: {
      type: 'string',
      minLength: 1,
      required: true
    }
  },
  required: true
};

var coordinatorSchema = {
  id: '/Coordinator',
  type: 'object',
  properties: {
    coordinatorConcurrency: {
      type: 'number',
      minimum: 1,
      required: true
    },
    maxApiConcurrency: {
      type: 'number',
      minimum: 1,
      required: true
    },
    maxInvocationCount: {
      type: 'number',
      minimum: 1,
      required: true
    },
    minInterval: {
      type: 'number',
      minimum: 0,
      maximum: constants.lambda.MAX_TIMEOUT,
      required: true
    }
  }
};

var deploymentSchema = {
  id: '/Deployment',
  type: 'object',
  properties: {
    region: {
      type: 'string',
      pattern: /(ap\-northeast|ap\-southeast|eu\-central|eu\-west|sa\-east|us\-east|us\-west)\-\d/,
      required: true
    },
    s3Bucket: {
      type: 'string',
      minLength: 1,
      required: true
    },
    s3KeyPrefix: {
      type: 'string',
      minLength: 1,
      required: true
    },
    skipPriorCloudFormationStackDeletion: {
      type: 'boolean',
      required: false
    },
    skipPriorCloudWatchLogGroupsDeletion: {
      type: 'boolean',
      required: false
    },
    skipCloudFormationStackDeletionOnFailure: {
      type: 'boolean',
      required: false
    },
    switchoverFunction: {
      isFunction: true,
      required: false
    },
    tags: {
      type: 'object',
      patternProperties: {
        // TODO: a better regexp here would match tag name restrictions in the
        // AWS API.
        '.*': {
          type: 'string',
          required: false
        }
      },
      required: false
    }
  }
};

var roleSchema = {
  id: '/Role',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      pattern: /[a-z0-9]+/i,
      required: true
    },
    statements: {
      type: 'array',
      items: {
        $ref: '/Statement'
      },
      required: true
    }
  }
};

var statementSchema = {
  id: '/Statement',
  type: 'object',
  properties: {
    effect: {
      type: 'string',
      enum: [
        'Allow',
        'Deny'
      ],
      required: true
    },
    // TODO: could probably write a matcher that catches at least some action
    // name errors.
    action: {
      anyOf: [
        {
          type: 'string',
          minLength: 1
        },
        {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1
          },
          minItems: 1
        }
      ],
      required: true
    },
    // TODO: could probably write a matcher that catches at least some resource
    // ARN errors.
    resource: {
      anyOf: [
        {
          type: 'string',
          minLength: 1
        },
        {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1
          },
          minItems: 1
        }
      ],
      required: true
    }
  }
};

var eventFromMessageComponentSchema = {
  id: '/EventFromMessageComponent',
  properties: {
    lambda: {
      $ref: '/Lambda',
      required: true
    },
    name: {
      type: 'string',
      pattern: /[a-z0-9]+/i,
      invalidValues: [
        constants.coordinator.NAME,
        constants.invoker.NAME
      ],
      required: true
    },
    maxConcurrency: {
      type: 'number',
      minimum: 1,
      required: true
    },
    queueWaitTime: {
      type: 'number',
      minimum: 0,
      maximum: constants.lambda.MAX_TIMEOUT,
      required: true
    },
    routing: {
      anyOf: [
        {
          type: 'string',
          pattern: /[a-z0-9]+/i
        },
        {
          type: 'array',
          items: {
            type: 'string',
            pattern: /[a-z0-9]+/i
          }
        },
        {
          isFunction: true
        }
      ],
      required: false
    },
    type: {
      type: 'string',
      enum: [
        constants.componentType.EVENT_FROM_MESSAGE
      ],
      required: true
    }
  }
};

var eventFromInvocationComponentSchema = {
  id: '/EventFromInvocationComponent',
  properties: {
    lambda: {
      $ref: '/Lambda',
      required: true
    },
    name: {
      type: 'string',
      pattern: /[a-z0-9]+/i,
      invalidValues: [
        constants.coordinator.NAME,
        constants.invoker.NAME
      ],
      required: true
    },
    routing: {
      anyOf: [
        {
          type: 'string',
          pattern: /[a-z0-9]+/i
        },
        {
          type: 'array',
          items: {
            type: 'string',
            pattern: /[a-z0-9]+/i
          }
        },
        {
          isFunction: true
        }
      ],
      required: false
    },
    type: {
      type: 'string',
      enum: [
        constants.componentType.EVENT_FROM_INVOCATION
      ],
      required: true
    }
  }
};

var lambdaSchema = {
  id: '/Lambda',
  properties: {
    handler: {
      type: 'string',
      // This is 'index.handler' or similar. Technically I suppose the file name
      // could be something like index.file.name.segments.js, so that
      // possibility has to be supported as well.
      pattern: /^.+\.[^\.]+$/,
      // Not allowed to use 'lc' as the handler name, as this will mess up the
      // wrapper code.
      invalidPattern: /\.lc$/,
      required: true
    },
    npmPackage: {
      type: 'string',
      minLength: 1,
      required: true
    },
    memorySize: {
      type: 'number',
      minimum: constants.lambda.MIN_MEMORY_SIZE,
      maximum: constants.lambda.MAX_MEMORY_SIZE,
      required: true
    },
    role: {
      type: 'string',
      pattern: /[a-z0-9]+/i,
      required: true
    },
    timeout: {
      type: 'number',
      minimum: constants.lambda.MIN_TIMEOUT,
      maximum: constants.lambda.MAX_TIMEOUT,
      required: true
    }
  }
};

// --------------------------------------------------------------------------
// Set up the validator.
// --------------------------------------------------------------------------

var validator = new jsonschema.Validator();

validator.addSchema(
  coordinatorSchema,
  '/Coordinator'
);
validator.addSchema(
  deploymentSchema,
  '/Deployment'
);
validator.addSchema(
  roleSchema,
  '/Role'
);
validator.addSchema(
  statementSchema,
  '/Statement'
);
validator.addSchema(
  eventFromMessageComponentSchema,
  '/EventFromMessageComponent'
);
validator.addSchema(
  eventFromInvocationComponentSchema,
  '/EventFromInvocationComponent'
);
validator.addSchema(
  lambdaSchema,
  '/Lambda'
);

/**
 * Since jsonschema doesn't seem to test function types properly at this point
 * in time, hack in an additional test.
 */
validator.attributes.isFunction = function (instance, schema, options, ctx) {
  var result = new jsonschema.ValidatorResult(instance, schema, options, ctx);

  if (!_.isBoolean(schema.isFunction)) {
    return result;
  }

  if (schema.isFunction) {
    if ((instance !== undefined) && (typeof instance !== 'function')) {
      result.addError('Required to be a function.');
    }
  }
  else {
    if (typeof instance === 'function') {
      result.addError('Required to not be a function.');
    }
  }

  return result;
};

/**
 * Validate against a blacklist of invalid values.
 */
validator.attributes.invalidValues = function (instance, schema, options, ctx) {
  var result = new jsonschema.ValidatorResult(instance, schema, options, ctx);

  if (!_.isArray(schema.invalidValues) || !schema.invalidValues.length) {
    return result;
  }

  var isInvalid = _.some(schema.invalidValues, function (invalidValue) {
    return jsonschemaHelpers.deepCompareStrict(invalidValue, instance);
  });

  if (isInvalid) {
    result.addError(util.format(
      'Value appears in list of invalid values: %s',
      JSON.stringify(instance, null, '  ')
    ));
  }

  return result;
};

/**
 * Validate against a blacklist regexp.
 */
validator.attributes.invalidPattern = function (instance, schema, options, ctx) {
  var result = new jsonschema.ValidatorResult(instance, schema, options, ctx);

  if (!_.isString(instance) || !_.isRegExp(schema.invalidPattern)) {
    return result;
  }

  if (instance.match(schema.invalidPattern)) {
    result.addError(util.format(
      'Value matches invalid patter: %s',
      instance
    ));
  }

  return result;
};

/**
 * Check an array of objects for duplicate values for specified property names.
 */
validator.attributes.noDuplicatePropertyValuesFor = function (instance, schema, options, ctx) {
  var result = new jsonschema.ValidatorResult(instance, schema, options, ctx);

  if (_.isString(schema.noDuplicatePropertyValuesFor)) {
    schema.noDuplicatePropertyValuesFor = [schema.noDuplicatePropertyValuesFor];
  }

  if (!_.isArray(schema.noDuplicatePropertyValuesFor) || !_.isArray(instance)) {
    return result;
  }

  _.each(schema.noDuplicatePropertyValuesFor, function (prop) {
    var duplicates = _.chain(instance).countBy(function (component) {
      return component[prop];
    }).map(function (count, value) {
      if (count > 1) {
        return value;
      }
    }).compact().value();

    if (duplicates.length) {
      result.addError(util.format(
        'Duplicate values for property %s: %s',
        prop,
        duplicates.join(', ')
      ));
    }
  });

  return result;
};

// --------------------------------------------------------------------------
// Validation checks that do not use jsonschema.
// --------------------------------------------------------------------------

// Some of the checks have to cross-reference between different parts of the
// configuration, which jsonschema isn't good at.

/**
 * Check to see that the role names speficied in components are correct.
 *
 * Append errors to the provided array.
 *
 * @param {Object} config A configuration object.
 * @param {Error[]} An array of errors.
 */
function validateComponentRoleNames (config, errors) {
  var roleNames = _.map(config.roles, function (role) {
    return role.name;
  });

  var invalidComponentRoles = _.chain(
    config.components
  ).map(function (component) {
    return component.lambda.role;
  }).filter(function (name) {
    return !_.contains(roleNames, name);
  }).value();

  if (invalidComponentRoles.length) {
    errors.push(new Error(util.format(
      'One or more invalid role names specified in components: %s',
      invalidComponentRoles.join(', ')
    )));
  }
}

/**
 * Check to see that string routing destinations are valid component names.
 *
 * Append errors to the provided array.
 *
 * @param {Object} config A configuration object.
 * @param {Error[]} An array of errors.
 */
function validateRoutingComponentNames (config, errors) {
  var componentNames = _.map(config.components, function (component) {
    return component.name;
  });

  var invalidComponentNames = [];

  var routings = _.chain(
    config.components
  ).map(function (component) {
    return component.routing;
  }).filter(function (routing) {
    return _.isString(routing) || _.isArray(routing);
  }).value();

  _.each(routings, function (routing) {
    if (!_.isArray(routing)) {
      routing = [routing];
    }

    invalidComponentNames = invalidComponentNames.concat(_.difference(
      routing,
      componentNames
    ));
  });

  if (invalidComponentNames.length) {
    errors.push(new Error(util.format(
      'One or more invalid component names specified in routing: %s',
      invalidComponentNames.join(', ')
    )));
  }
}

// --------------------------------------------------------------------------
// Exported functions.
// --------------------------------------------------------------------------

/**
 * Validate the provided configuration.
 *
 * @param {Object} config A configuration object.
 * @return {Error[]} An array of errors.
 */
exports.validate = function (config) {
  var result = validator.validate(config, configSchema) || {};
  var errors = result.errors || [];

  // Non-jsonschema checks. Not worth getting into these if there are already
  // errors, as they presuppose that the structure of the JSON is correct.
  if (!errors.length) {
    validateComponentRoleNames(config, errors);
    validateRoutingComponentNames(config, errors);
  }

  return errors;
};
