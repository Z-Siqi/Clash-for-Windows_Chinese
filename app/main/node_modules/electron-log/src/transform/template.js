'use strict';

module.exports = {
  concatFirstStringElements: concatFirstStringElements,
  formatDate: formatDate,
  formatTimeZone: formatTimeZone,
  pad: pad,
  padString: padString,
  templateDate: templateDate,
  templateVariables: templateVariables,
  templateScopeFactory: templateScopeFactory,
  templateText: templateText,
};

/**
 * The first argument of console.log may contain templates. In the library
 * the first element is a string related to transports.console.format. So
 * this function concatenates first two elements to make templates like %d
 * work
 * @param {*[]} data
 * @return {*[]}
 */
function concatFirstStringElements(data) {
  if (typeof data[0] !== 'string' || typeof data[1] !== 'string') {
    return data;
  }

  if (data[0].match(/%[1cdfiOos]/)) {
    return data;
  }

  data[1] = data[0] + ' ' + data[1];
  data.shift();

  return data;
}

function formatDate(template, date) {
  return template
    .replace('{y}', String(date.getFullYear()))
    .replace('{m}', pad(date.getMonth() + 1))
    .replace('{d}', pad(date.getDate()))
    .replace('{h}', pad(date.getHours()))
    .replace('{i}', pad(date.getMinutes()))
    .replace('{s}', pad(date.getSeconds()))
    .replace('{ms}', pad(date.getMilliseconds(), 3))
    .replace('{z}', formatTimeZone(date.getTimezoneOffset()))
    .replace('{iso}', date.toISOString());
}

function formatTimeZone(minutesOffset) {
  var m = Math.abs(minutesOffset);
  return (minutesOffset >= 0 ? '-' : '+')
    + pad(Math.floor(m / 60)) + ':'
    + pad(m % 60);
}

function pad(number, zeros) {
  zeros = zeros || 2;
  return (new Array(zeros + 1).join('0') + number).substr(-zeros, zeros);
}

function padString(value, length) {
  length = Math.max(length, value.length);
  var padValue = Array(length + 1).join(' ');
  return (value + padValue).substring(0, length);
}

function templateDate(data, message) {
  var template = data[0];
  if (typeof template !== 'string') {
    return data;
  }

  data[0] = formatDate(template, message.date);
  return data;
}

/**
 * @param {{ labelLength: number, defaultLabel: string }} options
 */
function templateScopeFactory(options) {
  options = options || {};
  var labelLength = options.labelLength || 0;

  return function templateScope(data, message) {
    var template = data[0];
    var label = message.scope && message.scope.label;

    if (!label) {
      label = options.defaultLabel;
    }

    var scopeText;
    if (label === '') {
      scopeText = labelLength > 0 ? padString('', labelLength + 3) : '';
    } else if (typeof label === 'string') {
      scopeText = padString(' (' + label + ')', labelLength + 3);
    } else {
      scopeText = '';
    }

    data[0] = template.replace('{scope}', scopeText);
    return data;
  };
}

function templateVariables(data, message) {
  var template = data[0];
  var variables = message.variables;

  if (typeof template !== 'string' || !message.variables) {
    return data;
  }

  for (var i in variables) {
    if (!Object.prototype.hasOwnProperty.call(variables, i)) continue;
    template = template.replace('{' + i + '}', variables[i]);
  }

  // Add additional space to the end of {level}] template to align messages
  template = template.replace('{level}]', padString(message.level + ']', 6));
  template = template.replace('{level}', message.level);

  data[0] = template;
  return data;
}

function templateText(data) {
  var template = data[0];
  if (typeof template !== 'string') {
    return data;
  }

  var textTplPosition = template.lastIndexOf('{text}');
  if (textTplPosition === template.length - 6) {
    data[0] = template.replace(/\s?{text}/, '');
    if (data[0] === '') {
      data.shift();
    }

    return data;
  }

  var templatePieces = template.split('{text}');
  var result = [];

  if (templatePieces[0] !== '') {
    result.push(templatePieces[0]);
  }

  result = result.concat(data.slice(1));

  if (templatePieces[1] !== '') {
    result.push(templatePieces[1]);
  }

  return result;
}
