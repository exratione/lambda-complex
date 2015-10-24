/**
 * @fileOverview Tests for lib/grunt/tasks/build.
 */

// Local.
var build = require('../../../../lib/grunt/tasks/build')
var gruntCommon = require('../../../../lib/grunt/common');
var index = require('../../../../index');

describe('lib/grunt/tasks/build', function () {
  var callback;
  var config;
  var grunt;
  var sandbox;
  var taskFn;
  var taskFnContext;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    callback = sandbox.stub();
    grunt = {
      registerTask: function (name, description, fn) {
        taskFn = fn;
      }
    };
    taskFn = undefined;
    taskFnContext = {
      async: function () {
        return callback;
      }
    };

    sandbox.stub(index, 'build').yields();
    sandbox.stub(gruntCommon, 'getConfigurationFromOptionOrFail').returns(config);
    sandbox.spy(grunt, 'registerTask');
    sandbox.spy(taskFnContext, 'async');

    // This should wind up getting taskFn assigned.
    build(grunt);

    sinon.assert.calledWith(
      grunt.registerTask,
      'build',
      'Build a Lambda Complex application.',
      taskFn
    );
    expect(taskFn).to.be.instanceOf(Function);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('task function functions as expected', function (done) {
    taskFn.call(taskFnContext);

    setTimeout(function () {
      sinon.assert.calledWith(taskFnContext.async);
      sinon.assert.calledWith(
        index.build,
        config,
        sinon.match.func
      );
      sinon.assert.calledWith(callback);

      done();
    }, 10);
  });
});
