/**
 * @fileOverview Grunt task lambda-complex-build.
 *
 * Build a Lambda Complex application.
 */

// Local.
var common = require('../lib/grunt/common');
var index = require('../index');

module.exports = function (grunt) {
  grunt.registerTask(
    'lambda-complex-build',
    'Build a Lambda Complex application.',
    function () {
      var done = this.async();
      var config = common.getConfigurationFromOptionOrFail(grunt);

      index.build(config, done);
    }
  );
};
