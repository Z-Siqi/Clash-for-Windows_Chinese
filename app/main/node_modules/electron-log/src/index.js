'use strict';

var catchErrors = require('./catchErrors');
var electronApi = require('./electronApi');
var log = require('./log');
var scopeFactory = require('./scope');
var transportConsole = require('./transports/console');
var transportFile = require('./transports/file');
var transportIpc = require('./transports/ipc');
var transportRemote = require('./transports/remote');

module.exports = create('default');
module.exports.default = module.exports;

/**
 * @param {string} logId
 * @return {ElectronLog.ElectronLog}
 */
function create(logId) {
  /**
   * @type {ElectronLog.ElectronLog}
   */
  var instance = {
    catchErrors: function callCatchErrors(options) {
      var opts = Object.assign({}, {
        log: instance.error,
        showDialog: process.type === 'browser',
      }, options || {});

      catchErrors(opts);
    },
    create: create,
    functions: {},
    hooks: [],
    isDev: electronApi.isDev(),
    levels: [],
    logId: logId,
    variables: {
      processType: process.type,
    },
  };

  instance.scope = scopeFactory(instance);

  instance.transports = {
    console: transportConsole(instance),
    file: transportFile(instance),
    remote: transportRemote(instance),
    ipc: transportIpc(instance),
  };

  Object.defineProperty(instance.levels, 'add', {
    enumerable: false,
    value: function add(name, index) {
      index = index === undefined ? instance.levels.length : index;
      instance.levels.splice(index, 0, name);
      instance[name] = log.log.bind(null, instance, { level: name });
      instance.functions[name] = instance[name];
    },
  });

  ['error', 'warn', 'info', 'verbose', 'debug', 'silly'].forEach(
    function (level) { instance.levels.add(level) }
  );

  instance.log = log.log.bind(null, instance, { level: 'info' });
  instance.functions.log = instance.log;

  instance.logMessageWithTransports = function logMessageWithTransports(
    message,
    transports
  ) {
    if (message.date === undefined) {
      message.date = new Date();
    }

    if (message.variables === undefined) {
      message.variables = instance.variables;
    }

    return log.runTransports(transports, message, instance);
  };

  return instance;
}
