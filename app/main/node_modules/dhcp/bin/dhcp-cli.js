#!/usr/bin/env node

/*
 * Example:
 * 
 * $ dhcp hostname dns --mac 12:34:55:67:88:99
 */

process.title = 'node-dhcp';

var dhcp = require('../lib/dhcp.js');
var argv = require('minimist')(process.argv.slice(2));

// Create a client

// minimist pushes all features, without "--" to the "_" key.
// We need the list of features on "features" and all other options passed as is.
// Easist way to do this is this:
argv.features = argv._;

var client = dhcp.createClient(argv);

client.on('bound', function(state) {

  var opt = state.options;

  // Print all requested options
  for (var i in opt) {
    console.log(i, ": ", opt[i] instanceof Array ? opt[i].join(", ") : opt[i]);
  }

  // Exit when finished
  process.exit();
});

client.listen();

// Send first handshake
client.sendDiscover();
