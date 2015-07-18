/**
 * @fileOverview Set up some of the globals for testing.
 */

var chai = require('chai');
var sinon = require('sinon');

global.sinon = sinon;

global.assert = chai.assert;
global.expect = chai.expect;
global.should = chai.should();
