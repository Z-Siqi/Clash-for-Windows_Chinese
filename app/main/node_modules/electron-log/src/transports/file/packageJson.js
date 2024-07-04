'use strict';

/* eslint-disable consistent-return */

var fs = require('fs');
var path = require('path');

module.exports = {
  readPackageJson: readPackageJson,
  tryReadJsonAt: tryReadJsonAt,
};

/**
 * @return {{ name?: string, version?: string}}
 */
function readPackageJson() {
  return tryReadJsonAt(require.main && require.main.filename)
    || tryReadJsonAt(process.resourcesPath, 'app.asar')
    || tryReadJsonAt(process.resourcesPath, 'app')
    || tryReadJsonAt(process.cwd())
    || { name: null, version: null };
}

/**
 * @param {...string} searchPath
 * @return {{ name?: string, version?: string } | null}
 */
function tryReadJsonAt(searchPath) {
  try {
    searchPath = path.join.apply(path, arguments);
    var fileName = findUp('package.json', searchPath);
    if (!fileName) {
      return null;
    }

    var json = JSON.parse(fs.readFileSync(fileName, 'utf8'));
    var name = json.productName || json.name;
    if (!name || name.toLowerCase() === 'electron') {
      return null;
    }

    if (json.productName || json.name) {
      return {
        name: name,
        version: json.version,
      };
    }
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} fileName
 * @param {string} [cwd]
 * @return {string | null}
 */
function findUp(fileName, cwd) {
  var currentPath = cwd;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    var parsedPath = path.parse(currentPath);
    var root = parsedPath.root;
    var dir = parsedPath.dir;

    if (fs.existsSync(path.join(currentPath, fileName))) {
      return path.resolve(path.join(currentPath, fileName));
    }

    if (currentPath === root) {
      return null;
    }

    currentPath = dir;
  }
}
