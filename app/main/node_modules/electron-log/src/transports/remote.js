'use strict';

var http = require('http');
var https = require('https');
var url = require('url');
var transform = require('../transform');

module.exports = remoteTransportFactory;

function remoteTransportFactory(electronLog) {
  transport.client = { name: 'electron-application' };
  transport.depth = 6;
  transport.level = false;
  transport.requestOptions = {};
  transport.url = null;
  transport.onError = null;
  transport.transformBody = function (body) { return JSON.stringify(body) };

  return transport;

  function transport(message) {
    if (!transport.url) return;

    var body = transport.transformBody({
      client: transport.client,
      data: transform.transform(message, [
        transform.removeStyles,
        transform.toJSON,
        transform.maxDepthFactory(transport.depth + 1),
      ]),
      date: message.date.getTime(),
      level: message.level,
      variables: message.variables,
    });

    var request = post(
      transport.url,
      transport.requestOptions,
      Buffer.from(body, 'utf8')
    );

    request.on('error', transport.onError || onError);

    function onError(error) {
      electronLog.logMessageWithTransports(
        {
          data: [
            'electron-log.transports.remote:'
            + ' cannot send HTTP request to ' + transport.url,
            error,
          ],
          level: 'warn',
        },
        [
          electronLog.transports.console,
          electronLog.transports.ipc,
          electronLog.transports.file,
        ]
      );
    }
  }
}

function post(serverUrl, requestOptions, body) {
  var urlObject = url.parse(serverUrl);
  var httpTransport = urlObject.protocol === 'https:' ? https : http;

  var options = {
    hostname: urlObject.hostname,
    port:     urlObject.port,
    path:     urlObject.path,
    method:   'POST',
    headers:  {},
  };

  Object.assign(options, requestOptions);

  options.headers['Content-Length'] = body.length;
  if (!options.headers['Content-Type']) {
    options.headers['Content-Type'] = 'application/json';
  }

  var request = httpTransport.request(options);
  request.write(body);
  request.end();

  return request;
}
