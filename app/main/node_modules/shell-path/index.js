'use strict';
const shellEnv = require('shell-env');

module.exports = () => shellEnv().then(x => x.PATH);
module.exports.sync = () => shellEnv.sync().PATH;
