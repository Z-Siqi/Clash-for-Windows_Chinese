/**
 * @license DHCP.js v0.2.20 28/06/2017
 * http://www.xarg.org/2017/06/a-pure-javascript-dhcp-implementation/
 *
 * Copyright (c) 2017, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/

const Options = require('./options.js').opts;

function trimZero(str) {

  const pos = str.indexOf('\x00');

  return pos === -1 ? str : str.substr(0, pos);
}

function SeqBuffer(buf, len) {

  this._data = buf || Buffer.alloc(len || 1500); // alloc() fills the buffer with '0'
}

SeqBuffer.prototype = {

  _data: null,
  _r: 0,
  _w: 0,

  addUInt8: function(val) {
    this._w = this._data.writeUInt8(val, this._w, true);
  },
  getUInt8: function() {
    return this._data.readUInt8(this._r++, true);
  },
  //
  addInt8: function(val) {
    this._w = this._data.writeInt8(val, this._w, true);
  },
  getInt8: function() {
    return this._data.readInt8(this._r++, true);
  },
  //
  addUInt16: function(val) {
    this._w = this._data.writeUInt16BE(val, this._w, true);
  },
  getUInt16: function() {
    return this._data.readUInt16BE((this._r += 2) - 2, true);
  },
  //
  addInt16: function(val) {
    this._w = this._data.writeInt16BE(val, this._w, true);
  },
  getInt16: function() {
    return this._data.readInt16BE((this._r += 2) - 2, true);
  },
  //
  addUInt32: function(val) {
    this._w = this._data.writeUInt32BE(val, this._w, true);
  },
  getUInt32: function() {
    return this._data.readUInt32BE((this._r += 4) - 4, true);
  },
  //
  addInt32: function(val) {
    this._w = this._data.writeInt32BE(val, this._w, true);
  },
  getInt32: function() {
    return this._data.readInt32BE((this._r += 4) - 4, true);
  },
  //
  addUTF8: function(val) {
    this._w += this._data.write(val, this._w, 'utf8');
  },
  addUTF8Pad: function(val, fixLen) {

    let len = Buffer.from(val, 'utf8').length;
    for (let n = 0; len > fixLen; n++) {
      val = val.slice(0, fixLen - n); // Truncate as long as character length is > fixLen
      len = Buffer.from(val, 'utf8').length;
    }

    this._data.fill(0, this._w, this._w + fixLen);
    this._data.write(val, this._w, 'utf8');
    this._w += fixLen;
  },
  getUTF8: function(len) {
    return trimZero(this._data.toString('utf8', this._r, this._r += len));
  },
  //
  addASCII: function(val) {
    this._w += this._data.write(val, this._w, 'ascii');
  },
  addASCIIPad: function(val, fixLen) {
    this._data.fill(0, this._w, this._w + fixLen);
    this._data.write(val.slice(0, fixLen), this._w, 'ascii');
    this._w += fixLen;
  },
  getASCII: function(len) {
    return trimZero(this._data.toString('ascii', this._r, this._r += len));
  },
  //
  addIP: function(ip) {
    const self = this;
    const octs = ip.split('.');

    if (octs.length !== 4) {
      throw new Error('Invalid IP address ' + ip);
    }

    for (let val of octs) {

      val = parseInt(val, 10);
      if (0 <= val && val < 256) {
        self.addUInt8(val);
      } else {
        throw new Error('Invalid IP address ' + ip);
      }
    }
  },
  getIP: function() {

    return        this.getUInt8() +
            '.' + this.getUInt8() +
            '.' + this.getUInt8() +
            '.' + this.getUInt8();
  },
  //
  addIPs: function(ips) {

    if (ips instanceof Array) {
      for (let ip of ips) {
        this.addIP(ip);
      }
    } else {
      this.addIP(ips);
    }
  },
  getIPs: function(len) {
    const ret = [];
    for (let i = 0; i < len; i += 4) {
      ret.push(this.getIP());
    }
    return ret;
  },
  //
  addMac: function(mac) {

    const octs = mac.split(/[-:]/);

    if (octs.length !== 6) {
      throw new Error('Invalid Mac address ' + mac);
    }

    for (let val of octs) {
      val = parseInt(val, 16);
      if (0 <= val && val < 256) {
        this.addUInt8(val);
      } else {
        throw new Error('Invalid Mac address ' + mac);
      }
    }

    // Add 10 more byte to pad 16 byte
    this.addUInt32(0);
    this.addUInt32(0);
    this.addUInt16(0);
  },
  getMAC: function(htype, hlen) {

    const mac = this._data.toString('hex', this._r, this._r += hlen);

    if (htype !== 1 || hlen !== 6) {
      throw new Error('Invalid hardware address (len=' + hlen + ', type=' + htype + ')');
    }

    this._r += 10; // + 10 since field is 16 byte and only 6 are used for htype=1
    return mac.toUpperCase().match(/../g).join('-');
  },
  //
  addBool: function() {
    /* void */
  },
  getBool: function() {
    return true;
  },
  //
  addOptions: function(opts) {

    for (let i in opts) {

      if (opts.hasOwnProperty(i)) {

        const opt = Options[i];
        let len = 0;
        let val = opts[i];

        if (val === null) {
          continue;
        }

        switch (opt.type) {
          case 'UInt8':
          case 'Int8':
            len = 1;
            break;
          case 'UInt16':
          case 'Int16':
            len = 2;
            break;
          case 'UInt32':
          case 'Int32':
          case 'IP':
            len = 4;
            break;
          case 'IPs':
            len = val instanceof Array ? 4 * val.length : 4;
            break;
          case 'ASCII':
            len = val.length;
            if (len === 0)
              continue; // Min length has to be 1
            if (len > 255) {
              console.error(val + ' too long, truncating...');
              val = val.slice(0, 255);
              len = 255;
            }
            break;
          case 'UTF8':
            len = Buffer.from(val, 'utf8').length;
            if (len === 0)
              continue; // Min length has to be 1
            for (let n = 0; len > 255; n++) {
              val = val.slice(0, 255 - n); // Truncate as long as character length is > 255
              len = Buffer.from(val, 'utf8').length;
            }
            break;
          case 'Bool':
            if (!(val === true || val === 1 || val === '1' || val === 'true' || val === 'TRUE' || val === 'True'))
              continue;
            // Length must be zero, so nothing to do here
            break;
          case 'UInt8s':
            len = val instanceof Array ? val.length : 1;
            break;
          case 'UInt16s':
            len = val instanceof Array ? 2 * val.length : 2;
            break;
          default:
            throw new Error('No such type ' + opt.type);
        }

        // Write code
        this.addUInt8(i);

        // Write length
        this.addUInt8(len);

        // Write actual data
        this['add' + opt.type](val);
      }
    }
  },
  getOptions: function() {

    const options = {};
    const buf = this._data;

    while (this._r < buf.length) {

      let opt = this.getUInt8();

      if (opt === 0xff) { // End type
        break;
      } else if (opt === 0x00) { // Pad type
        this._r++; // NOP
      } else {

        let len = this.getUInt8();

        if (opt in Options) {
          options[opt] = this['get' + Options[opt].type](len);
        } else {
          this._r += len;
          console.error('Option ' + opt + ' not known');
        }
      }
    }
    return options;
  },
  //
  addUInt8s: function(arr) {

    if (arr instanceof Array) {
      for (let i = 0; i < arr.length; i++) {
        this.addUInt8(arr[i]);
      }
    } else {
      this.addUInt8(arr);
    }
  },
  getUInt8s: function(len) {
    const ret = [];
    for (let i = 0; i < len; i++) {
      ret.push(this.getUInt8());
    }
    return ret;
  },
  addUInt16s: function(arr) {

    if (arr instanceof Array) {
      for (let i = 0; i < arr.length; i++) {
        this.addUInt16(arr[i]);
      }
    } else {
      this.addUInt16(arr);
    }
  },
  getUInt16s: function(len) {
    const ret = [];
    for (let i = 0; i < len; i += 2) {
      ret.push(this.getUInt16());
    }
    return ret;
  },
  //
  getHex: function(len) {
    return this._data.toString('hex', this._r, this._r += len);
  }
};

module.exports = SeqBuffer;
