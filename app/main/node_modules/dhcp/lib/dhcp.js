/**
 * @license DHCP.js v0.2.20 28/06/2017
 * http://www.xarg.org/2017/06/a-pure-javascript-dhcp-implementation/
 *
 * Copyright (c) 2017, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/

const util = require('util');
const dgram = require('dgram');
const os = require('os');
const EventEmitter = require('events').EventEmitter;

const SeqBuffer = require('./seqbuffer.js');
const Options = require('./options.js');
const Protocol = require('./protocol.js');
const Tools = require('./tools.js');

const DHCPDISCOVER = 1;
const DHCPOFFER = 2;
const DHCPREQUEST = 3;
const DHCPDECLINE = 4;
const DHCPACK = 5;
const DHCPNAK = 6;
const DHCPRELEASE = 7;
const DHCPINFORM = 8;

const SERVER_PORT = 67;
const CLIENT_PORT = 68;

const INADDR_ANY = '0.0.0.0';
const INADDR_BROADCAST = '255.255.255.255';

const BOOTREQUEST = 1;
const BOOTREPLY = 2;



function Lease() {

}

Lease.prototype = {
  bindTime: null, // Time when we got an ACK
  leasePeriod: 86400, // Seconds the lease is allowed to live, next lease in "leasePeriod - (now - bindTime)"
  renewPeriod: 1440, // Seconds till a renew is due, next renew in "renewPeriod - (now - bindTime)"
  rebindPeriod: 14400, // Seconds till a rebind is due, next rebind in "rebindPeriod - (now - bindTime)"
  state: null, // Current State, like BOUND, INIT, REBOOTING, ...
  server: null, // The server we got our config from
  address: null, // actual IP address we got
  options: null, // object of all other options we got
  tries: 0, // number of tries in order to complete a state
  xid: 1 // unique id, incremented with every request
};


function Server(config, listenOnly) {

  EventEmitter.call(this);

  const self = this;
  const sock = dgram.createSocket({type: 'udp4', reuseAddr: true});

  sock.on('message', function(buf) {

    let req;

    try {
      req = Protocol.parse(buf);
    } catch (e) {
      self.emit('error', e);
      return;
    }

    self._req = req;

    if (req.op !== BOOTREQUEST) {
      self.emit('error', new Error('Malformed packet'), req);
      return;
    }

    if (!req.options[53]) {
      self.emit('error', new Error('Got message, without valid message type'), req);
      return;
    }

    self.emit('message', req);

    if (!listenOnly) {
      // Handle request
      switch (req.options[53]) {
        case DHCPDISCOVER: // 1.
          self.handleDiscover(req);
          break;
        case DHCPREQUEST: // 3.
          self.handleRequest(req);
          break;
        default:
          console.error("Not implemented method", req.options[53]);
      }
    }
  });

  sock.on('listening', function() {
    self.emit('listening', sock);
  });

  sock.on('close', function() {
    self.emit('close');
  });

  sock.on('error', function(e) {
    self.emit('error',e);
  });

  this._sock = sock;
  this._conf = config;
  this._state = {};
}

Server.prototype = {

  // Socket handle
  _sock: null,

  // Config (cache) object
  _conf: null,

  // All mac -> IP mappings, we currently have assigned or blacklisted
  _state: null,

  // Incoming request
  _req: null,

  config: function(key) {

    let val;
    const optId = Options.conf[key];

    // If config setting is set by user
    if (undefined !== this._conf[key]) {
      val = this._conf[key];
    } else if (undefined !== Options.opts[optId]) {
      val = Options.opts[optId].default;
      if (val === undefined)
        return 0; // Better idea?
    } else {
      throw new Error('Invalid option ' + key);
    }

    // If a function was provided
    if (val instanceof Function) {
      var reqOpt = {};
      for (var i in this._req.options) {
        var opt = Options.opts[i];
        if (opt.enum) {
          reqOpt[opt.attr || i] = opt.enum[this._req.options[i]];
        } else {
          reqOpt[opt.attr || i] = this._req.options[i];
        }
      }
      val = val.call(this, reqOpt);
    }

    // If the option has an "enum" attribute:
    if (key !== 'range' && key !== 'static' && key !== 'randomIP' && Options.opts[optId].enum) {
      const values = Options.opts[optId].enum;

      // Check if value is an actual enum string
      for (let i in values) {
        if (values[i] === val) {
          return parseInt(i, 10);
        }
      }

      // Okay, check  if it is the numeral value of the enum
      if (values[val] === undefined) {
        throw new Error('Provided enum value for ' + key + ' is not valid');
      } else {
        val = parseInt(val, 10);
      }
    }
    return val;
  },
  _getOptions: function(pre, required, requested) {

    for (let req of required) {

      // Check if option id actually exists
      if (Options.opts[req] !== undefined) {

        // Take the first config value always
        if (pre[req] === undefined) {
          pre[req] = this.config(Options.opts[req].config);
        }

        if (!pre[req]) {
          throw new Error('Required option ' + Options.opts[req].config + ' does not have a value set');
        }

      } else {
        this.emit('error', 'Unknown option ' + req);
      }
    }

    // Add all values, the user wants, which are not already provided:
    if (requested) {

      for (let req of requested) {

        // Check if option id actually exists
        if (Options.opts[req] !== undefined) {

          // Take the first config value always
          if (pre[req] === undefined) {
            const val = this.config(Options.opts[req].config);
            // Add value only, if it's meaningful
            if (val) {
              pre[req] = val;
            }
          }

        } else {
          this.emit('error', 'Unknown option ' + req);
        }
      }
    }

    // Finally Add all missing and forced options
    const forceOptions = this._conf.forceOptions;
    if (forceOptions instanceof Array) {
      for (let option of forceOptions) {

        // Add numeric options right away and look up alias names
        let id;
        if (isNaN(option)) {
          id = Options.conf[option];
        } else {
          id = option;
        }

        // Add option if it is valid and not present yet
        if (id !== undefined && pre[id] === undefined) {
          pre[id] = this.config(option);
        }
      }
    }
    return pre;
  },

  _selectAddress: function(clientMAC, req) {

    /*
     * IP Selection algorithm:
     *
     * 0. Is Mac already known, send same IP of known lease
     *
     * 1. Is there a wish for static binding?
     *
     * 2. Are all available IP's occupied?
     *    - Send release to oldest lease and reuse
     *
     * 3. is config randomIP?
     *    - Select random IP of range, until no occupied slot is found
     *
     * 4. Take first unmapped IP of range
     *
     * TODO:
     * - Incorporate user preference, sent to us
     * - Check APR if IP exists on net
     */


    // If existing lease for a mac address is present, re-use the IP
    if (this._state[clientMAC] && this._state[clientMAC].address) {
      return this._state[clientMAC].address;
    }



    // Is there a static binding?
    const _static = this.config('static');
    if (typeof _static === "function") {
      const staticResult = _static(clientMAC, req);
      if (staticResult)
        return staticResult;
    } else if (_static[clientMAC]) {
      return _static[clientMAC];
    }


    const randIP = this.config('randomIP');
    const _tmp = this.config('range');
    const firstIP = Tools.parseIp(_tmp[0]);
    const lastIP = Tools.parseIp(_tmp[1]);



    // Add all known addresses and save the oldest lease
    const ips = [this.config('server')]; // Exclude our own server IP from pool
    let oldestMac = null;
    let oldestTime = Infinity;
    let leases = 0;
    for (let mac in this._state) {
      if (this._state[mac].address)
        ips.push(this._state[mac].address);

      if (this._state[mac].leaseTime < oldestTime) {
        oldestTime = this._state[mac].leaseTime;
        oldestMac = mac;
      }
      leases++;
    }




    // Check if all IP's are used and delete the oldest
    if (oldestMac !== null && lastIP - firstIP === leases) {
      const ip = this._state[oldestMac].address;

      // TODO: Notify deleted client
      delete this._state[oldestMac];

      return ip;
    }




    // Select a random IP, maybe not the best algorithm for quick selection if lots of ip's are given: TODO
    if (randIP) {

      while (1) {

        const ip = Tools.formatIp(firstIP + Math.random() * (lastIP - firstIP) | 0);

        if (ips.indexOf(ip) === -1) {
          return ip;
        }
      }
    }



    // Choose first free IP in subnet
    for (let i = firstIP; i <= lastIP; i++) {

      const ip = Tools.formatIp(i);

      if (ips.indexOf(ip) === -1) {
        return ip;
      }
    }
  },

  handleDiscover: function(req) {
    //console.log('Handle Discover', req);

    const lease = this._state[req.chaddr] = this._state[req.chaddr] || new Lease;
    lease.address = this._selectAddress(req.chaddr, req);
    lease.leasePeriod = this.config('leaseTime');
    lease.server = this.config('server');
    lease.state = 'OFFERED';

    this.sendOffer(req);
  },
  sendOffer: function(req) {

    //console.log('Send Offer');

    // Formulate the response object
    const ans = {
      op: BOOTREPLY,
      htype: 1, // RFC1700, hardware types: 1=Ethernet, 2=Experimental, 3=AX25, 4=ProNET Token Ring, 5=Chaos, 6=Tokenring, 7=Arcnet, 8=FDDI, 9=Lanstar (keep it constant)
      hlen: 6, // Mac addresses are 6 byte
      hops: 0,
      xid: req.xid, // 'xid' from client DHCPDISCOVER message
      secs: 0,
      flags: req.flags,
      ciaddr: INADDR_ANY,
      yiaddr: this._selectAddress(req.chaddr), // My offer
      siaddr: this.config('server'), // next server in bootstrap. That's us
      giaddr: req.giaddr,
      chaddr: req.chaddr, // Client mac address
      sname: '',
      file: '',
      options: this._getOptions({
        53: DHCPOFFER
      }, [
        1, 3, 51, 54, 6
      ], req.options[55])
    };

    // Send the actual data
    // INADDR_BROADCAST : 68 <- SERVER_IP : 67
    this._send(this.config('broadcast'), ans);

  },

  handleRequest: function(req) {
    //console.log('Handle Request', req);

    const lease = this._state[req.chaddr] = this._state[req.chaddr] || new Lease;
    lease.address = this._selectAddress(req.chaddr);
    lease.leasePeriod = this.config('leaseTime');
    lease.server = this.config('server');
    lease.state = 'BOUND';
    lease.bindTime = new Date;

    this.sendAck(req);
  },
  sendAck: function(req) {
    //console.log('Send ACK');
    // Formulate the response object
    const ans = {
      op: BOOTREPLY,
      htype: 1, // RFC1700, hardware types: 1=Ethernet, 2=Experimental, 3=AX25, 4=ProNET Token Ring, 5=Chaos, 6=Tokenring, 7=Arcnet, 8=FDDI, 9=Lanstar (keep it constant)
      hlen: 6, // Mac addresses are 6 byte
      hops: 0,
      xid: req.xid, // 'xid' from client DHCPREQUEST message
      secs: 0,
      flags: req.flags, // 'flags' from client DHCPREQUEST message
      ciaddr: req.ciaddr,
      yiaddr: this._selectAddress(req.chaddr), // my offer
      siaddr: this.config('server'), // server ip, that's us
      giaddr: req.giaddr, // 'giaddr' from client DHCPREQUEST message
      chaddr: req.chaddr, // 'chaddr' from client DHCPREQUEST message
      sname: '',
      file: '',
      options: this._getOptions({
        53: DHCPACK
      }, [
        1, 3, 51, 54, 6
      ], req.options[55])
    };

    this.emit('bound', this._state);

    // Send the actual data
    // INADDR_BROADCAST : 68 <- SERVER_IP : 67
    this._send(this.config('broadcast'), ans);
  },
  sendNak: function(req) {
    //console.log('Send NAK');
    // Formulate the response object
    const ans = {
      op: BOOTREPLY,
      htype: 1, // RFC1700, hardware types: 1=Ethernet, 2=Experimental, 3=AX25, 4=ProNET Token Ring, 5=Chaos, 6=Tokenring, 7=Arcnet, 8=FDDI, 9=Lanstar (keep it constant)
      hlen: 6, // Mac addresses are 6 byte
      hops: 0,
      xid: req.xid, // 'xid' from client DHCPREQUEST message
      secs: 0,
      flags: req.flags, // 'flags' from client DHCPREQUEST message
      ciaddr: INADDR_ANY,
      yiaddr: INADDR_ANY,
      siaddr: INADDR_ANY,
      giaddr: req.giaddr, // 'giaddr' from client DHCPREQUEST message
      chaddr: req.chaddr, // 'chaddr' from client DHCPREQUEST message
      sname: '', // unused
      file: '', // unused
      options: this._getOptions({
        53: DHCPNAK
      }, [
        54
      ])
    };

    // Send the actual data
    this._send(this.config('broadcast'), ans);
  },

  handleRelease: function() {

  },

  handleRenew: function() {
    // Send ack
  },

  listen: function(port, host, fn) {

    const sock = this._sock;

    sock.bind(port || SERVER_PORT, host || INADDR_ANY, function() {
      sock.setBroadcast(true);
      if (fn instanceof Function) {
        process.nextTick(fn);
      }
    });
  },

  close: function(callback) {
    this._sock.close(callback);
  },

  _send: function(host, data) {

    const sb = Protocol.format(data);

    this._sock.send(sb._data, 0, sb._w, CLIENT_PORT, host, function(err, bytes) {
      if (err) {
        console.log(err);
      } else {
        //console.log('Sent ', bytes, 'bytes');
      }
    });
  }

};








function Client(config) {

  EventEmitter.call(this);

  const self = this;
  const sock = dgram.createSocket({type: 'udp4', reuseAddr: true});

  sock.on('message', function(buf) {

    let req;

    try {
      req = Protocol.parse(buf);
    } catch (e) {
      self.emit('error', e);
      return;
    }

    self._req = req;

    if (req.op !== BOOTREPLY) {
      self.emit('error', new Error('Malformed packet'), req);
      return;
    }

    if (!req.options[53]) {
      self.emit('error', new Error('Got message, without valid message type'), req);
      return;
    }

    self.emit('message', req);

    // Handle request
    switch (req.options[53]) {
      case DHCPOFFER: // 2.
        self.handleOffer(req);
        break;
      case DHCPACK: // 4.
      case DHCPNAK: // 4.
        self.handleAck(req);
        break;
    }
  });

  sock.on('listening', function() {
    self.emit('listening', sock);
  });

  sock.on('close', function() {
    self.emit('close');
  });

  this._sock = sock;
  this._conf = config || {};
  this._state = new Lease;
}

Client.prototype = {

  // Socket handle
  _sock: null,

  // Config (cache) object
  _conf: null,

  // Current client state
  _state: null,

  // Incoming request
  _req: null,

  config: function(key) {

    if (key === 'mac') {

      if (this._conf.mac === undefined) {

        const interfaces = os.networkInterfaces();

        for (let intf in interfaces) {
          const addresses = interfaces[intf];
          for (let address in addresses) {
            if (addresses[address].family === 'IPv4' && !addresses[address].internal) {

              if (this._conf.mac === undefined) {
                this._conf.mac = addresses[address].mac;
              } else {
                throw new Error('Too many network interfaces, set mac address manually:\n\tclient = dhcp.createClient({mac: "12:23:34:45:56:67"});');
              }
            }
          }
        }
      }
      return this._conf.mac;

    } else if (key === 'features') {

      // Default list we request
      const def = [
        1, // netmask
        3, // routers
        51, // lease time
        54, // server ID
        6 // DNS
      ];

      const ft = this._conf.features;

      if (ft) {

        for (let f of ft) {

          let id = Options.conf[f];
          if (id) {

            id = parseInt(id, 10);

            if (def.indexOf(id) === -1) {
              def.push(id);
            }

          } else {
            throw new Error('Unknown option ' + f);
          }
        }

        return def;
      }

    } else {
      throw new Error('Unknown config key ' + key);
    }
  },

  sendDiscover: function() {

    //console.log('Send Discover');

    const mac = this.config('mac');

    // Formulate the response object
    const ans = {
      op: BOOTREQUEST,
      htype: 1, // RFC1700, hardware types: 1=Ethernet, 2=Experimental, 3=AX25, 4=ProNET Token Ring, 5=Chaos, 6=Tokenring, 7=Arcnet, 8=FDDI, 9=Lanstar (keep it constant)
      hlen: 6, // Mac addresses are 6 byte
      hops: 0,
      xid: this._state.xid++, // Selected by client on DHCPDISCOVER
      secs: 0, // 0 or seconds since DHCP process started
      flags: 0, // 0 or 0x80 (if client requires broadcast reply)
      ciaddr: INADDR_ANY, // 0 for DHCPDISCOVER, other implementations send currently assigned IP - but we follow RFC
      yiaddr: INADDR_ANY,
      siaddr: INADDR_ANY,
      giaddr: INADDR_ANY,
      chaddr: mac,
      sname: '', // unused
      file: '', // unused
      options: {
        57: 1500, // Max message size
        53: DHCPDISCOVER,
        61: mac, // MAY
        55: this.config('features') // MAY
                // TODO: requested IP optional
      }
    };

    this._state.state = 'SELECTING';
    this._state.tries = 0;

    // TODO: set timeouts

    // Send the actual data
    // INADDR_ANY : 68 -> INADDR_BROADCAST : 67
    this._send(INADDR_BROADCAST, ans);
  },
  handleOffer: function(req) {
    //console.log('Handle Offer', req);

    // Select an offer out of all offers
    // We simply take the first one and change the state then

    if (req.options[54]) {
      // Check if we already sent a request to the first appearing server
      if (this._state.state !== 'REQUESTING') {
        this.sendRequest(req);
      }
    } else {
      this.emit('error', 'Offer does not have a server identifier', req);
    }
  },

  sendRequest: function(req) {

    //console.log('Send Request');

    // Formulate the response object
    const ans = {
      op: BOOTREQUEST,
      htype: 1, // RFC1700, hardware types: 1=Ethernet, 2=Experimental, 3=AX25, 4=ProNET Token Ring, 5=Chaos, 6=Tokenring, 7=Arcnet, 8=FDDI, 9=Lanstar (keep it constant)
      hlen: 6, // Mac addresses are 6 byte
      hops: 0,
      xid: req.xid, // 'xid' from server DHCPOFFER message
      secs: 0, // 0 or seconds since DHCP process started
      flags: 0, // 0 or 0x80 (if client requires broadcast reply)
      ciaddr: INADDR_ANY, // 0 for DHCPREQUEST
      yiaddr: INADDR_ANY,
      siaddr: INADDR_ANY,
      giaddr: INADDR_ANY,
      chaddr: this.config('mac'),
      sname: '', // unused
      file: '', // unused
      options: {
        57: 1500, // Max message size
        53: DHCPREQUEST,
        61: this.config('mac'), // MAY
        55: this.config('features'), // MAY
        50: this._state.address, // requested IP, TODO: MUST (selecting or INIT REBOOT) MUST NOT (BOUND, RENEW)
        // TODO: server identifier: MUST (after selecting) MUST NOT (INIT REBOOT, BOUND, RENEWING, REBINDING)
      }
    };

    this._state.server = req.options[54];
    this._state.address = req.yiaddr;
    this._state.state = 'REQUESTING';
    this._state.tries = 0;

    // TODO: retry timeout

    // INADDR_ANY : 68 -> INADDR_BROADCAST : 67
    this._send(INADDR_BROADCAST, ans);
  },
  handleAck: function(req) {

    if (req.options[53] === DHCPACK) {
      // We now know the IP for sure
      //console.log('Handle ACK', req);

      this._state.bindTime = new Date;
      this._state.state = 'BOUND';
      this._state.address = req.yiaddr;
      this._state.options = {};

      // Lease time is available
      if (req.options[51]) {
        this._state.leasePeriod = req.options[51];
        this._state.renewPeriod = req.options[51] / 2;
        this._state.rebindPeriod = req.options[51];
      }

      // Renewal time is available
      if (req.options[58]) {
        this._state.renewPeriod = req.options[58];
      }

      // Rebinding time is available
      if (req.options[59]) {
        this._state.rebindPeriod = req.options[59];
      }

      // TODO: set renew & rebind timer

      const options = req.options;
      this._state.options = {};

      // Map all options from request
      for (let id in options) {

        if (id === '53' || id === '51' || id === '58' || id === '59')
          continue;

        const conf = Options.opts[id];
        const key = conf.config || conf.attr;

        if (conf.enum) {
          this._state.options[key] = conf.enum[options[id]];
        } else {
          this._state.options[key] = options[id];
        }
      }

      // If netmask is not given, set it to a class related mask
      if (!this._state.options.netmask) {

        this._state.options.netmask = Tools.formatIp(
                Tools.netmaskFromIP(this._state.address));
      }

      const cidr = Tools.CIDRFromNetmask(this._state.options.netmask);

      // If router is not given, guess one
      if (!this._state.options.router) {
        this._state.options.router = Tools.formatIp(
                Tools.gatewayFromIpCIDR(this._state.address, cidr));
      }

      // If broadcast is missing
      if (!this._state.options.broadcast) {
        this._state.options.broadcast = Tools.formatIp(
                Tools.broadcastFromIpCIDR(this._state.address, cidr));
      }

      this.emit('bound', this._state);

    } else {
      // We're sorry, today we have no IP for you...
    }
  },

  sendRelease: function(req) {

    //console.log('Send Release');

    // Formulate the response object
    const ans = {
      op: BOOTREQUEST,
      htype: 1, // RFC1700, hardware types: 1=Ethernet, 2=Experimental, 3=AX25, 4=ProNET Token Ring, 5=Chaos, 6=Tokenring, 7=Arcnet, 8=FDDI, 9=Lanstar (keep it constant)
      hlen: 6, // Mac addresses are 6 byte
      hops: 0,
      xid: this._state.xid++, // Selected by client on DHCPRELEASE
      secs: 0, // 0 or seconds since DHCP process started
      flags: 0,
      ciaddr: this.config('server'),
      yiaddr: INADDR_ANY,
      siaddr: INADDR_ANY,
      giaddr: INADDR_ANY,
      chaddr: this.config('mac'),
      sname: '', // unused
      file: '', // unused
      options: {
        53: DHCPRELEASE,
        // TODO: MAY clientID
        54: this._state.server // MUST server identifier
      }
    };

    this._state.bindTime = null;
    this._state.state = 'RELEASED';
    this._state.tries = 0;

    this.emit('released');

    // Send the actual data
    this._send(this._state.server, ans); // Send release directly to server
  },

  sendRenew: function() {

    //console.log('Send Renew');

    // TODO: check ans against rfc

    // Formulate the response object
    const ans = {
      op: BOOTREQUEST,
      htype: 1, // RFC1700, hardware types: 1=Ethernet, 2=Experimental, 3=AX25, 4=ProNET Token Ring, 5=Chaos, 6=Tokenring, 7=Arcnet, 8=FDDI, 9=Lanstar (keep it constant)
      hlen: 6, // Mac addresses are 6 byte
      hops: 0,
      xid: this._state.xid++, // Selected by client on DHCPRELEASE
      secs: 0, // 0 or seconds since DHCP process started
      flags: 0,
      ciaddr: this.config('server'),
      yiaddr: INADDR_ANY,
      siaddr: INADDR_ANY,
      giaddr: INADDR_ANY,
      chaddr: this.config('mac'),
      sname: '', // unused
      file: '', // unused
      options: {
        53: DHCPREQUEST,
        50: this._state.address,
        // TODO: MAY clientID
        54: this._state.server // MUST server identifier
      }
    };

    this._state.state = 'RENEWING';
    this._state.tries = 0;

    // Send the actual data
    this._send(this._state.server, ans); // Send release directly to server
  },

  sendRebind: function() {

    //console.log('Send Rebind');

    // TODO: check ans against rfc

    // Formulate the response object
    const ans = {
      op: BOOTREQUEST,
      htype: 1, // RFC1700, hardware types: 1=Ethernet, 2=Experimental, 3=AX25, 4=ProNET Token Ring, 5=Chaos, 6=Tokenring, 7=Arcnet, 8=FDDI, 9=Lanstar (keep it constant)
      hlen: 6, // Mac addresses are 6 byte
      hops: 0,
      xid: this._state.xid++, // Selected by client on DHCPRELEASE
      secs: 0, // 0 or seconds since DHCP process started
      flags: 0,
      ciaddr: this.config('server'),
      yiaddr: INADDR_ANY,
      siaddr: INADDR_ANY,
      giaddr: INADDR_ANY,
      chaddr: this.config('mac'),
      sname: '', // unused
      file: '', // unused
      options: {
        53: DHCPREQUEST,
        50: this._state.address,
        // TODO: MAY clientID
        54: this._state.server // MUST server identifier
      }
    };

    this._state.state = 'REBINDING';
    this._state.tries = 0;

    // TODO: timeout

    // Send the actual data
    this._send(INADDR_BROADCAST, ans); // Send release directly to server
  },

  listen: function(port, host, fn) {

    const sock = this._sock;

    sock.bind(port || CLIENT_PORT, host || INADDR_ANY, function() {
      sock.setBroadcast(true);
      if (fn instanceof Function) {
        process.nextTick(fn);
      }
    });
  },

  close: function(callback) {
    this._sock.close(callback);
  },

  _send: function(host, data) {

    const sb = Protocol.format(data);

    this._sock.send(sb._data, 0, sb._w, SERVER_PORT, host, function(err, bytes) {
      if (err) {
        console.log(err);
      } else {
        //console.log('Sent ', bytes, 'bytes');
      }
    });
  }

};

util.inherits(Server, EventEmitter);
util.inherits(Client, EventEmitter);

exports.DHCP = exports.default = module.exports = {
  createServer: function(opt) {
    return new Server(opt);
  },
  createClient: function(opt) {
    return new Client(opt);
  },
  createBroadcastHandler: function() {
    return new Server(null, true);
  },
  addOption: Options.addOption,
  DHCPDISCOVER: DHCPDISCOVER,
  DHCPOFFER: DHCPOFFER,
  DHCPREQUEST: DHCPREQUEST,
  DHCPDECLINE: DHCPDECLINE,
  DHCPACK: DHCPACK,
  DHCPNAK: DHCPNAK,
  DHCPRELEASE: DHCPRELEASE,
  DHCPINFORM: DHCPINFORM
};
