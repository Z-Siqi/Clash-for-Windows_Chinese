'use strict';

var os = require('os');
var path = require('path');
var electronApi = require('../../electronApi');
var packageJson = require('./packageJson');

module.exports = {
  getAppData: getAppData,
  getLibraryDefaultDir: getLibraryDefaultDir,
  getLibraryTemplate: getLibraryTemplate,
  getNameAndVersion: getNameAndVersion,
  getPathVariables: getPathVariables,
  getUserData: getUserData,
};

function getAppData(platform) {
  var appData = electronApi.getPath('appData');
  if (appData) {
    return appData;
  }

  var home = getHome();

  switch (platform) {
    case 'darwin': {
      return path.join(home, 'Library/Application Support');
    }

    case 'win32': {
      return process.env.APPDATA || path.join(home, 'AppData/Roaming');
    }

    default: {
      return process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    }
  }
}

function getHome() {
  return os.homedir ? os.homedir() : process.env.HOME;
}

function getLibraryDefaultDir(platform, appName) {
  if (platform === 'darwin') {
    return path.join(getHome(), 'Library/Logs', appName);
  }

  return path.join(getUserData(platform, appName), 'logs');
}

function getLibraryTemplate(platform) {
  if (platform === 'darwin') {
    return path.join(getHome(), 'Library/Logs', '{appName}');
  }

  return path.join(getAppData(platform), '{appName}', 'logs');
}

function getNameAndVersion() {
  var name = electronApi.getName() || '';
  var version = electronApi.getVersion();

  if (name.toLowerCase() === 'electron') {
    name = '';
    version = '';
  }

  if (name && version) {
    return { name: name, version: version };
  }

  var packageValues = packageJson.readPackageJson();
  if (!name) {
    name = packageValues.name;
  }

  if (!version) {
    version = packageValues.version;
  }

  return { name: name, version: version };
}

/**
 * @param {string} platform
 * @return {PathVariables}
 */
function getPathVariables(platform) {
  var nameAndVersion = getNameAndVersion();
  var appName = nameAndVersion.name;
  var appVersion = nameAndVersion.version;

  return {
    appData: getAppData(platform),
    appName: appName,
    appVersion: appVersion,
    electronDefaultDir: electronApi.getPath('logs'),
    home: getHome(),
    libraryDefaultDir: getLibraryDefaultDir(platform, appName),
    libraryTemplate: getLibraryTemplate(platform),
    temp: electronApi.getPath('temp') || os.tmpdir(),
    userData: getUserData(platform, appName),
  };
}

function getUserData(platform, appName) {
  if (electronApi.getName() !== appName) {
    return path.join(getAppData(platform), appName);
  }

  return electronApi.getPath('userData')
    || path.join(getAppData(platform), appName);
}
