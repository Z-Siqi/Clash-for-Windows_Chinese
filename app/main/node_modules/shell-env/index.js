'use strict';
const execa = require('execa');
const stripAnsi = require('strip-ansi');
const defaultShell = require('default-shell');

const args = ['-ilc', 'env; exit'];

function parseEnv(env) {
	const ret = {};

	stripAnsi(env).split('\n').forEach(x => {
		const parts = x.split('=');
		ret[parts.shift()] = parts.join('=');
	});

	return ret;
}

module.exports = shell => {
	if (process.platform === 'win32') {
		return Promise.resolve(process.env);
	}

	return execa(shell || defaultShell, args)
		.then(x => parseEnv(x.stdout))
		.catch(err => {
			if (shell) {
				throw err;
			} else {
				return process.env;
			}
		});
};

module.exports.sync = shell => {
	if (process.platform === 'win32') {
		return process.env;
	}

	try {
		const stdout = execa.sync(shell || defaultShell, args).stdout;
		return parseEnv(stdout);
	} catch (err) {
		if (shell) {
			throw err;
		} else {
			return process.env;
		}
	}
};
