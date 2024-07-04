#!/usr/bin/env node

/*
 * Example:
 * 
 * $ dhcp hostname dns --bind 192.168.2.2
 */

process.title = 'node-dhcp';

var dhcp = require('../lib/dhcp.js');
var Options = require('../lib/options.js');
var argv = require('minimist')(process.argv.slice(2));

var bind = null;
var opts = {};
var force = []; // We force all options here, since the user explicitly stated the option

// Create a server

for (var arg in argv) {
  if (arg === '_') {
    /* void */
  } else if (arg === 'bind') {
    bind = argv[arg];
  } else if (arg === 'range') {
    opts.range = argv[arg].split('-');
  } else if (Options.conf[arg] !== undefined) {

    // If value is missing, minimist simply makes it true/false
    if (typeof argv[arg] !== 'boolean') {
      opts[arg] = argv[arg];
      force.push(argv[arg]);
    } else {
      console.error('Argument ' + arg + ' needs a value.');
      process.exit();
    }

  } else if (arg === 'help') {
    console.log('Usage:\n\tdhcpd --range 192.168.0.1-192.168.0.99 --option1 value1 --option2 value2 ...');
    process.exit();
  } else {
    console.error('Invalid argument ' + arg);
    process.exit();
  }
}

var server = dhcp.createServer(opts);

server.on('bound', function(state) {
  console.log(state);
});

server.listen(null, bind);
