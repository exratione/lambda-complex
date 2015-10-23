/**
 * @fileOverview A configuration validator.
 */

// NPM.
var jsonschema = require('jsonschema');

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
      require: true
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
      ]
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
          }
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
          }
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
      // This is "index.handler" or similar. Technically I suppose the file name
      // could be something like index.file.name.segments.js.
      pattern: /^.+\.[^\.]+$/,
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

  if (schema.isFunction) {
    if (typeof instance !== 'function') {
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
  return result.errors || [];
};
