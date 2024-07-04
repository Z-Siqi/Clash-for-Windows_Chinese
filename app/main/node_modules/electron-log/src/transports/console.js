'use strict';

/* eslint-disable no-multi-spaces, no-console */

var transform = require('../transform');

var consoleMethods = {
  context: console,
  error:   console.error,
  warn:    console.warn,
  info:    console.info,
  verbose: console.verbose,
  debug:   console.debug,
  silly:   console.silly,
  log:     console.log,
};

module.exports = consoleTransportFactory;
module.exports.transformRenderer = transformRenderer;
module.exports.transformMain = transformMain;

var separator = process.platform === 'win32' ? '>' : '›';
var DEFAULT_FORMAT = {
  browser: '%c{h}:{i}:{s}.{ms}{scope}%c ' + separator + ' {text}',
  renderer: '{h}:{i}:{s}.{ms}{scope} › {text}',
  worker: '{h}:{i}:{s}.{ms}{scope} › {text}',
};

function consoleTransportFactory(electronLog) {
  transport.level  = 'silly';
  transport.useStyles = process.env.FORCE_STYLES;
  transport.format = DEFAULT_FORMAT[process.type] || DEFAULT_FORMAT.browser;

  return transport;

  function transport(message) {
    var scopeOptions = electronLog.scope.getOptions();

    var data;
    if (process.type === 'renderer' || process.type === 'worker') {
      data = transformRenderer(message, transport, scopeOptions);
    } else {
      data = transformMain(message, transport, scopeOptions);
    }

    consoleLog(message.level, data);
  }
}

function transformRenderer(message, transport, scopeOptions) {
  return transform.transform(message, [
    transform.customFormatterFactory(transport.format, true, scopeOptions),
  ]);
}

function transformMain(message, transport, scopeOptions) {
  var useStyles = canUseStyles(transport.useStyles, message.level);

  return transform.transform(message, [
    addTemplateColorFactory(transport.format),
    transform.customFormatterFactory(transport.format, false, scopeOptions),
    useStyles ? transform.applyAnsiStyles : transform.removeStyles,
    transform.concatFirstStringElements,
    transform.maxDepthFactory(4),
    transform.toJSON,
  ]);
}

function addTemplateColorFactory(format) {
  return function addTemplateColors(data, message) {
    if (format !== DEFAULT_FORMAT.browser) {
      return data;
    }

    return ['color:' + levelToStyle(message.level), 'color:unset'].concat(data);
  };
}

function canUseStyles(useStyleValue, level) {
  if (useStyleValue === true || useStyleValue === false) {
    return useStyleValue;
  }

  var useStderr = level === 'error' || level === 'warn';
  var stream = useStderr ? process.stderr : process.stdout;
  return stream && stream.isTTY;
}

function consoleLog(level, args) {
  var consoleMethod = consoleMethods[level] || consoleMethods.info;

  if (process.type === 'renderer') {
    setTimeout(consoleMethod.bind.apply(
      consoleMethod,
      [consoleMethod.context].concat(args)
    ));
    return;
  }

  consoleMethod.apply(consoleMethods.context, args);
}

function levelToStyle(level) {
  switch (level) {
    case 'error': return 'red';
    case 'warn':  return 'yellow';
    case 'info':  return 'cyan';
    default:      return 'unset';
  }
}
