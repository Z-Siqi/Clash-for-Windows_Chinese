'use strict';

const ns = {
  'win32-x64': 'win-x64',
  'win32-ia32': 'win-ia32',
  'win32-arm64': 'win-x64', // TODO: support arm64
  'darwin-x64': 'mac-x64',
  'darwin-arm64': 'mac-arm64'
};

const pa = `${process.platform}-${process.arch}`;
if (pa in ns) {
  module.exports = require('bindings')(ns[pa]);
} else {
  throw new Error(`Unsupported platform: ${pa}`);
}
