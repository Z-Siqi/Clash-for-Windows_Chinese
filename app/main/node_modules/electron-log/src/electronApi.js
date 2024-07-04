'use strict';

/**
 * Split Electron API from the main code
 */

var electron;
try {
  // eslint-disable-next-line global-require
  electron = require('electron');
} catch (e) {
  electron = null;
}

var os = require('os');

module.exports = {
  getName: getName,
  getPath: getPath,
  getVersion: getVersion,
  getVersions: getVersions,
  isDev: isDev,
  isElectron: isElectron,
  isIpcChannelListened: isIpcChannelListened,
  loadRemoteModule: loadRemoteModule,
  onIpc: onIpc,
  openUrl: openUrl,
  sendIpc: sendIpc,
  showErrorBox: showErrorBox,
};

function getApp() {
  return getElectronModule('app');
}

function getName() {
  var app = getApp();
  if (!app) return null;

  return 'name' in app ? app.name : app.getName();
}

function getElectronModule(name) {
  if (!electron) {
    return null;
  }

  if (electron[name]) {
    return electron[name];
  }

  if (electron.remote) {
    return electron.remote[name];
  }

  return null;
}

function getIpc() {
  if (process.type === 'browser' && electron && electron.ipcMain) {
    return electron.ipcMain;
  }

  if (process.type === 'renderer' && electron && electron.ipcRenderer) {
    return electron.ipcRenderer;
  }

  return null;
}

function getPath(name) {
  var app = getApp();
  if (!app) return null;

  try {
    return app.getPath(name);
  } catch (e) {
    return null;
  }
}

function getRemote() {
  if (electron && electron.remote) {
    return electron.remote;
  }

  return null;
}

function getVersion() {
  var app = getApp();
  if (!app) return null;

  return 'version' in app ? app.version : app.getVersion();
}

function getVersions() {
  return {
    app: getName() + ' ' + getVersion(),
    electron: 'Electron ' + process.versions.electron,
    os: getOsVersion(),
  };
}

function getOsVersion() {
  var osName = os.type().replace('_', ' ');
  var osVersion = os.release();

  if (osName === 'Darwin') {
    osName = 'macOS';
    osVersion = getMacOsVersion();
  }

  return osName + ' ' + osVersion;
}

function getMacOsVersion() {
  var release = Number(os.release().split('.')[0]);
  return '10.' + (release - 4);
}

function isDev() {
  var app = getApp();

  if (app && app.isPackaged !== undefined) {
    return app.isPackaged;
  }

  if (typeof process.execPath === 'string') {
    return process.execPath.toLowerCase().endsWith('electron');
  }

  return process.env.NODE_ENV === 'development'
    || process.env.ELECTRON_IS_DEV === '1';
}

function isElectron() {
  return process.type === 'browser' || process.type === 'renderer';
}

/**
 * Return true if the process listens for the IPC channel
 * @param {string} channel
 */
function isIpcChannelListened(channel) {
  var ipc = getIpc();
  return ipc ? ipc.listenerCount(channel) > 0 : false;
}

/**
 * Try to load the module in the opposite process
 * @param {string} moduleName
 */
function loadRemoteModule(moduleName) {
  if (process.type === 'browser') {
    getApp().on('web-contents-created', function (e, contents) {
      var promise = contents.executeJavaScript(
        'try {require("' + moduleName + '")} catch(e){}; void 0;'
      );

      // Do nothing on error, just prevent Unhandled rejection
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function () {});
      }
    });
  } else if (process.type === 'renderer') {
    try {
      getRemote().require(moduleName);
    } catch (e) {
      // Can't be required. Webpack?
    }
  }
}

/**
 * Listen to async messages sent from opposite process
 * @param {string} channel
 * @param {function} listener
 */
function onIpc(channel, listener) {
  var ipc = getIpc();
  if (ipc) {
    ipc.on(channel, listener);
  }
}

/**
 * Sent a message to opposite process
 * @param {string} channel
 * @param {any} message
 */
function sendIpc(channel, message) {
  if (process.type === 'browser') {
    sendIpcToRenderer(channel, message);
  } else if (process.type === 'renderer') {
    sendIpcToMain(channel, message);
  }
}

function sendIpcToMain(channel, message) {
  var ipc = getIpc();
  if (ipc) {
    ipc.send(channel, message);
  }
}

function sendIpcToRenderer(channel, message) {
  if (!electron || !electron.BrowserWindow) {
    return;
  }

  electron.BrowserWindow.getAllWindows().forEach(function (wnd) {
    if (wnd.webContents && !wnd.webContents.isDestroyed()) {
      wnd.webContents.send(channel, message);
    }
  });
}

function showErrorBox(title, message) {
  var dialog = getElectronModule('dialog');
  if (!dialog) return;

  dialog.showErrorBox(title, message);
}

/**
 * @param {string} url
 * @param {Function} [logFunction]
 */
function openUrl(url, logFunction) {
  // eslint-disable-next-line no-console
  logFunction = logFunction || console.error;

  var shell = getElectronModule('shell');
  if (!shell) return;

  shell.openExternal(url).catch(logFunction);
}
