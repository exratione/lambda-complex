/**
 * @fileOverview Definition file for grunt tasks.
 */

// Core.
var path = require('path');

module.exports = function (grunt) {

  // Always output stack traces.
  grunt.option('stack', true);

  grunt.initConfig({
    clean: [
      'build',
      'test/scratch'
    ],

    eslint: {
      target: [
        '**/*.js',
        '!**/node_modules/**',
        '!build/**',
        '!test/scratch/**'
      ]
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          quiet: false,
          clearRequireCache: false,
          require: [
            path.join(__dirname, 'test/mochaInit.js')
          ]
        },
        src: [
          'test/**/*.spec.js'
        ]
      }
    }
  });

  // Loads local tasks for this module.
  grunt.loadTasks('tasks');

  // Loading NPM module grunt tasks.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.registerTask('test', [
    'clean',
    'eslint',
    'mochaTest'
  ]);
};
