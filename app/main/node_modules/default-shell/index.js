'use strict';
module.exports = (() => {
	const env = process.env;

	if (process.platform === 'darwin') {
		return env.SHELL || '/bin/bash';
	}

	if (process.platform === 'win32') {
		return env.COMSPEC || 'cmd.exe';
	}

	return env.SHELL || '/bin/sh';
})();
