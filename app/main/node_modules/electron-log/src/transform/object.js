'use strict';

var util = require('util');

module.exports = {
  maxDepthFactory: maxDepthFactory,
  serialize: serialize,
  toJSON: toJSON,
  toStringFactory: toStringFactory,
};

function createSerializer() {
  var seen = createWeakSet();

  return function (key, value) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return undefined;
      }

      seen.add(value);
    }

    return serialize(key, value);
  };
}

/**
 * @return {WeakSet<object>}
 */
function createWeakSet() {
  if (typeof WeakSet !== 'undefined') {
    return new WeakSet();
  }

  var cache = [];
  return {
    add: function (value) { cache.push(value) },
    has: function (value) { return cache.indexOf(value) !== -1 },
  };
}

function maxDepth(data, depth) {
  if (!data) {
    return data;
  }

  if (depth < 1) {
    if (isArray(data)) return '[array]';
    if (typeof data === 'object' && data) return '[object]';

    return data;
  }

  if (isArray(data)) {
    return data.map(function (child) {
      return maxDepth(child, depth - 1);
    });
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data && typeof data.toISOString === 'function') {
    return data;
  }

  // noinspection PointlessBooleanExpressionJS
  if (data === null) {
    return null;
  }

  if (data instanceof Error) {
    return data;
  }

  var newJson = {};
  for (var i in data) {
    if (!Object.prototype.hasOwnProperty.call(data, i)) continue;
    newJson[i] = maxDepth(data[i], depth - 1);
  }

  return newJson;
}

function maxDepthFactory(depth) {
  depth = depth || 6;

  return function maxDepthFunction(data) {
    return maxDepth(data, depth);
  };
}

function serialize(key, value) {
  if (value instanceof Error) {
    return value.stack;
  }

  if (!value) {
    return value;
  }

  if (typeof value.toJSON === 'function') {
    return value.toJSON();
  }

  if (typeof value === 'function') {
    return '[function] ' + value.toString();
  }

  return value;
}

function toJSON(data) {
  return JSON.parse(JSON.stringify(data, createSerializer()));
}

function toStringFactory(inspectOptions) {
  return function toStringFunction(data) {
    var simplifiedData = data.map(function (item) {
      if (item === undefined) {
        return undefined;
      }

      var str = JSON.stringify(item, createSerializer(), '  ');
      if (str === undefined) {
        return undefined;
      }

      return JSON.parse(str);
    });

    if (util.formatWithOptions) {
      simplifiedData.unshift(inspectOptions || {});
      return util.formatWithOptions.apply(util, simplifiedData);
    }

    return util.format.apply(util, simplifiedData);
  };
}

function isArray(value) {
  return Object.prototype.toString.call(value) === '[object Array]';
}
