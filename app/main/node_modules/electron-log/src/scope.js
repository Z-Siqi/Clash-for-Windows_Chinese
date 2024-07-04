'use strict';

var log = require('./log').log;

module.exports = scopeFactory;

/**
 * @param {ElectronLog.ElectronLog} electronLog
 * @return {ElectronLog.Scope}
 */
function scopeFactory(electronLog) {
  scope.labelPadding = true;
  scope.defaultLabel = '';

  /** @private */
  scope.maxLabelLength = 0;

  /**
   * @type {typeof getOptions}
   * @package
   */
  scope.getOptions = getOptions;

  return scope;

  function scope(label) {
    var instance = {
      label: label,
      toJSON: function () {
        return {
          label: this.label,
        };
      },
    };

    electronLog.levels.forEach(function (level) {
      instance[level] = log.bind(null, electronLog, {
        level: level,
        scope: instance,
      });
    });

    instance.log = instance.info;

    scope.maxLabelLength = Math.max(scope.maxLabelLength, label.length);

    return instance;
  }

  function getOptions() {
    return {
      defaultLabel: scope.defaultLabel,
      labelLength: getLabelLength(),
    };
  }

  function getLabelLength() {
    if (scope.labelPadding === true) {
      return scope.maxLabelLength;
    }

    if (scope.labelPadding === false) {
      return 0;
    }

    if (typeof scope.labelPadding === 'number') {
      return scope.labelPadding;
    }

    return 0;
  }
}
