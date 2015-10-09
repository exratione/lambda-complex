/**
 * @fileOverview Tests for lib/shared/utilities.
 */

// Core.
var path = require('path');

// NPM.
var _ = require('lodash');

// Local.
var resources = require('../../resources');
var utilities = require('../../../lib/shared/utilities');
var applicationConfig = require('../../resources/mockApplication/applicationConfig');

describe('lib/shared/utilities', function () {

  var sandbox;
  var componentName;
  var arnMap;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    componentName = applicationConfig.components[0].name;
    arnMap = resources.getMockArnMap(applicationConfig);

    // Make sure we stub the AWS client functions used here.
    sandbox.stub(utilities.lambdaClient, 'invoke').yields();
    sandbox.stub(utilities.s3Client, 'getObject').yields(null, {
      Body: JSON.stringify(arnMap)
    });
    // These will need to be redefined to return data for tests that use them.
    sandbox.stub(utilities.sqsClient, 'deleteMessage').yields();
    sandbox.stub(utilities.sqsClient, 'receiveMessage').yields();
    sandbox.stub(utilities.sqsClient, 'sendMessage').yields();
    sandbox.stub(utilities.sqsClient, 'getQueueAttributes').yields();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('isArray', function () {
    it('functions correctly', function () {
      expect(utilities.isArray('string')).to.equal(false);
      expect(utilities.isArray({})).to.equal(false);
      expect(utilities.isArray(undefined)).to.equal(false);
      expect(utilities.isArray(null)).to.equal(false);
      expect(utilities.isArray(arguments)).to.equal(false);
      expect(utilities.isArray([])).to.equal(true);
    });
  });

  describe('capitalize', function () {
    it('functions correctly', function () {
      expect(utilities.capitalize('string')).to.equal('String');
      expect(utilities.capitalize('TwoStrings')).to.equal('TwoStrings');
      expect(utilities.capitalize('')).to.equal('');
      expect(utilities.capitalize({})).to.eql({});
      expect(utilities.capitalize(undefined)).to.equal(undefined);
      expect(utilities.capitalize(null)).to.equal(null);
      expect(utilities.capitalize([])).to.eql([]);
    });
  });

  describe('retry', function () {

    beforeEach(function () {
      sandbox.stub(console, 'error');
    });

    it('gives up on failures after defined number of retries', function (done) {
      var failing = sandbox.stub();
      failing.yields(new Error());

      utilities.retry(failing, 'error', function (error) {
        sinon.assert.callCount(console.error, utilities.retryLimit - 1);
        sinon.assert.callCount(failing, utilities.retryLimit);
        expect(error).to.be.an.instanceof(Error);
        done();
      });
    });

    it('does not retry success', function (done) {
      var succeeding = sandbox.stub();
      var result = {};
      succeeding.yields(undefined, result);

      utilities.retry(succeeding, 'error', function (error, retriedResult) {
        sinon.assert.callCount(console.error, 0);
        sinon.assert.callCount(succeeding, 1);
        expect(error).to.equal(undefined);
        expect(retriedResult).to.eql(result);
        done();
      });
    });

    it('can retry failure then return on success', function (done) {
      var fn = sandbox.stub();
      var result = {};
      fn.onCall(0).yields(new Error());
      fn.onCall(1).yields(undefined, result);

      utilities.retry(fn, 'error', function (error, retriedResult) {
        sinon.assert.callCount(console.error, 1);
        sinon.assert.callCount(fn, 2);
        expect(error).to.equal(undefined);
        expect(retriedResult).to.eql(result);
        done();
      });
    });
  });

  describe('each', function () {
    var data;
    var fn;

    beforeEach(function () {
      data = ['a', 'b', 'c'];
      fn = sandbox.stub().yields();
    });

    it('iterates over data', function (done) {
      utilities.each(data, fn, function (error) {
        expect(error).to.equal(undefined);
        sinon.assert.callCount(fn, 3);
        sinon.assert.calledWith(fn, data[0], sinon.match.func);
        sinon.assert.calledWith(fn, data[1], sinon.match.func);
        sinon.assert.calledWith(fn, data[2], sinon.match.func);
        done();
      });
    });

    it('calls back with error (0)', function (done) {
      fn.onCall(0).yields(new Error());

      utilities.each(data, fn, function (error) {
        expect(error).to.be.an.instanceof(Error);
        done();
      });
    });

    it('calls back with error (1)', function (done) {
      fn.onCall(1).yields(new Error());

      utilities.each(data, fn, function (error) {
        expect(error).to.be.an.instanceof(Error);
        done();
      });
    });

    it('calls back with error (2)', function (done) {
      fn.onCall(2).yields(new Error());

      utilities.each(data, fn, function (error) {
        expect(error).to.be.an.instanceof(Error);
        done();
      });
    });
  });

  describe('getFileBaseNameFromHandle', function () {
    it('functions correctly', function () {
      expect(
        utilities.getFileBaseNameFromHandle('index.handler')
      ).to.equal('index');
      expect(
        utilities.getFileBaseNameFromHandle('file.name.with.periods.handle')
      ).to.equal('file.name.with.periods');
    });
  });

  describe('getFunctionNameFromHandle', function () {
    it('functions correctly', function () {
      expect(
        utilities.getFunctionNameFromHandle('index.handler')
      ).to.equal('handler');
      expect(
        utilities.getFunctionNameFromHandle('file.name.with.periods.handler')
      ).to.equal('handler');
    });
  });

  describe('getRoleName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getRoleName(componentName);
      expect(fullName).to.equal(_.capitalize(componentName) + 'Role');
    });
  });

  describe('getQueueName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getQueueName(componentName);
      expect(fullName).to.equal(_.capitalize(componentName) + 'Queue');
    });
  });

  describe('getFullQueueName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getFullQueueName(
        componentName,
        applicationConfig
      );
      expect(fullName).to.equal(
        applicationConfig.name + '-' +
        applicationConfig.deployId + '-' +
        utilities.getQueueName(componentName)
      );
    });
  });

  describe('getConcurrencyQueueName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getConcurrencyQueueName(componentName);
      expect(fullName).to.equal(_.capitalize(componentName) + 'ConcurrencyQueue');
    });
  });

  describe('getFullConcurrencyQueueName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getFullConcurrencyQueueName(
        componentName,
        applicationConfig
      );
      expect(fullName).to.equal(
        applicationConfig.name + '-' +
        applicationConfig.deployId + '-' +
        utilities.getConcurrencyQueueName(componentName)
      );
    });
  });

  describe('getLambdaFunctionName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getLambdaFunctionName(componentName);
      expect(fullName).to.equal(_.capitalize(componentName));
    });
  });

  describe('getQueueArnOutputName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getQueueArnOutputName(componentName);
      expect(fullName).to.equal(
        utilities.getQueueName(componentName) + 'Arn'
      );
    });
  });

  describe('getConcurrencyQueueArnOutputName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getConcurrencyQueueArnOutputName(componentName);
      expect(fullName).to.equal(
        utilities.getConcurrencyQueueName(componentName) + 'Arn'
      );
    });
  });

  describe('getLambdaFunctionArnOutputName', function () {
    it('functions correctly', function () {
      var fullName = utilities.getLambdaFunctionArnOutputName(componentName);
      expect(fullName).to.equal(
        utilities.getLambdaFunctionName(componentName) + 'Arn'
      );
    });
  });

  describe('getQueueArn', function () {
    it('functions correctly', function () {
      var arn = utilities.getQueueArn(componentName, arnMap);

      expect(arn).to.be.a('string');
      expect(arn).to.equal(
        arnMap[utilities.getQueueArnOutputName(componentName)]
      );
    });

    it('returns undefined for non-existing value', function () {
      expect(utilities.getQueueArn('', arnMap)).to.equal(undefined);
    });
  });

  describe('getConcurrencyQueueArn', function () {
    it('functions correctly', function () {
      var arn = utilities.getConcurrencyQueueArn(componentName, arnMap);

      expect(arn).to.be.a('string');
      expect(arn).to.equal(
        arnMap[utilities.getConcurrencyQueueArnOutputName(componentName)]
      );
    });

    it('returns undefined for non-existing value', function () {
      expect(utilities.getQueueArn('', arnMap)).to.equal(undefined);
    });
  });

  describe('sqsUrlFromArn', function () {
    it('functions correctly', function () {
      expect(utilities.sqsUrlFromArn(
        'arn:aws:sqs:us-east-1:444555666777:queuename'
      )).to.equal(
        'https://sqs.us-east-1.amazonaws.com/444555666777/queuename'
      );
    });
  });

  describe('getQueueUrl', function () {
    it('functions correctly', function () {
      sandbox.stub(utilities, 'getQueueArn').returns(
        'arn:aws:sqs:us-east-1:444555666777:queuename'
      );

      var url = utilities.getQueueUrl(componentName, arnMap);
      expect(url).to.equal(
        'https://sqs.us-east-1.amazonaws.com/444555666777/queuename'
      );
    });
  });

  describe('getConcurrencyQueueUrl', function () {
    it('functions correctly', function () {
      sandbox.stub(utilities, 'getConcurrencyQueueArn').returns(
        'arn:aws:sqs:us-east-1:444555666777:queuename'
      );

      var url = utilities.getConcurrencyQueueUrl(componentName, arnMap);
      expect(url).to.equal(
        'https://sqs.us-east-1.amazonaws.com/444555666777/queuename'
      );
    });
  });

  describe('getLambdaFunctionArn', function () {
    it('functions correctly', function () {
      var arn = utilities.getLambdaFunctionArn(componentName, arnMap);

      expect(arn).to.be.a('string');
      expect(arn).to.equal(
        arnMap[utilities.getLambdaFunctionArnOutputName(componentName)]
      );
    });

    it('returns undefined for non-existing value', function () {
      expect(utilities.getLambdaFunctionArn('', arnMap)).to.equal(undefined);
    });
  });

  describe('invoke', function () {
    var payload;
    var functionArn;

    beforeEach(function () {
      payload = {};
      functionArn = 'functionArn';
    });

    it('calls the AWS API as expected', function (done) {
      utilities.invoke(functionArn, payload, function (error) {
        expect(error).to.equal(undefined);

        sinon.assert.callCount(
          utilities.lambdaClient.invoke,
          1
        );
        sinon.assert.alwaysCalledWith(
          utilities.lambdaClient.invoke,
          sinon.match({
            FunctionName: functionArn,
            InvocationType: 'Event',
            LogType: 'None',
            Payload: JSON.stringify(payload)
          }),
          sinon.match.func
        );

        done();
      });
    });

    it('retries AWS API on failure', function (done) {

      sandbox.stub(console, 'error');
      utilities.lambdaClient.invoke.onCall(0).yields(new Error());
      utilities.lambdaClient.invoke.onCall(1).yields();

      utilities.invoke(functionArn, payload, function (error) {
        expect(error).to.equal(undefined);

        sinon.assert.callCount(console.error, 1);
        sinon.assert.callCount(
          utilities.lambdaClient.invoke,
          2
        );
        sinon.assert.alwaysCalledWith(
          utilities.lambdaClient.invoke,
          sinon.match({
            FunctionName: functionArn,
            InvocationType: 'Event',
            LogType: 'None',
            Payload: JSON.stringify(payload)
          }),
          sinon.match.func
        );

        done();
      });
    });

  });

  describe('sendMessage', function () {
    var payload;
    var queueUrl;

    beforeEach(function () {
      payload = {};
      queueUrl = 'queueUrl';
    });

    it('calls the AWS API as expected', function (done) {
      utilities.sendMessage(queueUrl, payload, function (error) {
        sinon.assert.callCount(utilities.sqsClient.sendMessage, 1);
        sinon.assert.alwaysCalledWith(
          utilities.sqsClient.sendMessage,
          sinon.match({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(payload)
          }),
          sinon.match.func
        );

        done(error);
      });
    });

    it('retries AWS API on failure', function (done) {
      sandbox.stub(console, 'error');
      utilities.sqsClient.sendMessage.onCall(0).yields(new Error());
      utilities.sqsClient.sendMessage.onCall(1).yields();

      utilities.sendMessage(queueUrl, payload, function (error) {
        sinon.assert.callCount(console.error, 1);
        sinon.assert.callCount(utilities.sqsClient.sendMessage, 2);
        sinon.assert.alwaysCalledWith(
          utilities.sqsClient.sendMessage,
          sinon.match({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(payload)
          }),
          sinon.match.func
        );

        done(error);
      });
    });

  });

  describe('deleteMessage', function () {
    var receiptHandle;
    var queueUrl;

    beforeEach(function () {
      receiptHandle = 'receipt-handle';
      queueUrl = 'queueUrl';
    });

    it('calls the AWS API as expected', function (done) {
      utilities.deleteMessage(queueUrl, receiptHandle, function (error) {
        expect(error).to.equal(undefined);

        sinon.assert.callCount(utilities.sqsClient.deleteMessage, 1);
        sinon.assert.alwaysCalledWith(
          utilities.sqsClient.deleteMessage,
          sinon.match({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle
          }),
          sinon.match.func
        );

        done();
      });
    });
  });

  describe('receiveMessage', function () {
    var waitTime;
    var visibilityTimeout;
    var eventFromMessage;
    var message;
    var queueUrl;

    beforeEach(function () {
      waitTime = 0;
      visibilityTimeout = 60;
      eventFromMessage = {};
      message = {
        MessageId: 'test',
        ReceiptHandle: 'test-receipt-handle',
        Body: JSON.stringify(eventFromMessage)
      };
      queueUrl = 'queueUrl';
    });

    it('calls the AWS API as expected', function (done) {
      utilities.sqsClient.receiveMessage.yields(
        undefined,
        {
          Messages: [message]
        }
      );

      utilities.receiveMessage(queueUrl, visibilityTimeout, waitTime, function (error, result) {
        expect(error).to.equal(undefined);

        sinon.assert.callCount(utilities.sqsClient.receiveMessage, 1);
        sinon.assert.alwaysCalledWith(
          utilities.sqsClient.receiveMessage,
          sinon.match({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            VisibilityTimeout: visibilityTimeout,
            WaitTimeSeconds: waitTime
          }),
          sinon.match.func
        );

        expect(result).to.eql({
          message: message.Body,
          receiptHandle: message.ReceiptHandle
        });

        done();
      });
    });

    it('returns an undefined result for no message', function (done) {
      utilities.sqsClient.receiveMessage.yields(
        undefined,
        {
          Messages: []
        }
      );

      utilities.receiveMessage(queueUrl, visibilityTimeout, waitTime, function (error, result) {
        expect(error).to.equal(undefined);
        expect(result).to.equal(undefined);
        done();
      });
    });

  });

  describe('getQueueAttributes', function () {
    var attributes;
    var queueUrl;

    beforeEach(function () {
      attributes = {
        ApproximateNumberOfMessages: 0
      };
      queueUrl = 'queueUrl';

      utilities.sqsClient.getQueueAttributes.yields(
        undefined,
        {
          Attributes: attributes
        }
      );
    });

    it('calls the AWS API as expected', function (done) {
      utilities.getQueueAttributes(queueUrl, function (error, result) {
        sinon.assert.callCount(utilities.sqsClient.getQueueAttributes, 1);
        sinon.assert.alwaysCalledWith(
          utilities.sqsClient.getQueueAttributes,
          sinon.match({
            QueueUrl: queueUrl,
            AttributeNames: [
              'ApproximateNumberOfMessages'
            ]
          }),
          sinon.match.func
        );

        expect(result).to.eql(attributes);
        done(error);
      });
    });

    it('retries AWS API on failure', function (done) {
      sandbox.stub(console, 'error');
      utilities.sqsClient.getQueueAttributes.onCall(0).yields(new Error());

      utilities.getQueueAttributes(queueUrl, function (error, result) {
        sinon.assert.callCount(console.error, 1);
        sinon.assert.callCount(utilities.sqsClient.getQueueAttributes, 2);
        sinon.assert.alwaysCalledWith(
          utilities.sqsClient.getQueueAttributes,
          sinon.match({
            QueueUrl: queueUrl,
            AttributeNames: [
              'ApproximateNumberOfMessages'
            ]
          }),
          sinon.match.func
        );

        expect(result).to.eql(attributes);
        done(error);
      });
    });


  });

  describe('getFullS3KeyPrefix', function () {
    it('functions correctly', function () {
      expect(utilities.getFullS3KeyPrefix(applicationConfig)).to.equal(
        path.join(
          applicationConfig.deployment.s3KeyPrefix,
          applicationConfig.name,
          // Could be a number or a string.
          '' + applicationConfig.deployId
        )
      );
    });
  });

  describe('getArnMapS3Key', function () {
    it('functions correctly', function () {
      expect(utilities.getArnMapS3Key(applicationConfig)).to.equal(
        path.join(
          utilities.getFullS3KeyPrefix(applicationConfig),
          'arnMap.json'
        )
      );
    });
  });

  describe('loadArnMap', function () {

    it('calls the AWS API as expected', function (done) {
      utilities.loadArnMap(applicationConfig, function (error, loadedArnMap) {
        expect(error).to.equal(null);
        expect(loadedArnMap).to.eql(arnMap);

        sinon.assert.callCount(utilities.s3Client.getObject, 1);
        sinon.assert.alwaysCalledWith(
          utilities.s3Client.getObject,
          sinon.match({
            Bucket: applicationConfig.deployment.s3Bucket,
            Key: utilities.getArnMapS3Key(applicationConfig)
          }),
          sinon.match.func
        );

        done();
      });
    });

    it('retries AWS API on failure', function (done) {

      sandbox.stub(console, 'error');
      utilities.s3Client.getObject.onCall(0).yields(new Error());

      utilities.loadArnMap(applicationConfig, function (error, loadedArnMap) {
        expect(error).to.equal(null);
        expect(loadedArnMap).to.eql(arnMap);

        sinon.assert.callCount(console.error, 1);
        sinon.assert.callCount(utilities.s3Client.getObject, 2);
        sinon.assert.alwaysCalledWith(
          utilities.s3Client.getObject,
          sinon.match({
            Bucket: applicationConfig.deployment.s3Bucket,
            Key: utilities.getArnMapS3Key(applicationConfig)
          }),
          sinon.match.func
        );

        done();
      });
    });

  });

});
