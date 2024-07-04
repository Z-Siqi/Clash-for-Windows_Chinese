/**
 * @license DHCP.js v0.2.20 28/06/2017
 * http://www.xarg.org/2017/06/a-pure-javascript-dhcp-implementation/
 *
 * Copyright (c) 2017, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/

const SeqBuffer = require('./seqbuffer.js');

module.exports = {

  parse: function(buf) {
    
    if (buf.length < 230) { // 230 byte minimum length of DHCP packet
      throw new Error('Received data is too short');
    }

    const sb = new SeqBuffer(buf);

    let hlen, htype;

    // RFC 2131
    return {
      op: sb.getUInt8(), // op code: 1=request, 2=reply
      htype: (htype = sb.getUInt8()), // hardware addr type: 1 for 10mb ethernet
      hlen: (hlen = sb.getUInt8()), // hardware addr length: 6 for 10mb ethernet
      hops: sb.getUInt8(), // relay hop count
      xid: sb.getUInt32(), // session id, initialized by client
      secs: sb.getUInt16(), // seconds since client began address acquistion
      flags: sb.getUInt16(), // 
      ciaddr: sb.getIP(), // client IP when BOUND, RENEW, REBINDING state
      yiaddr: sb.getIP(), // 'your' client IP
      siaddr: sb.getIP(), // next server to use in boostrap, returned in OFFER & ACK
      giaddr: sb.getIP(), // gateway/relay agent IP
      chaddr: sb.getMAC(htype, hlen), // client hardware address
      sname: sb.getUTF8(64), // server host name
      file: sb.getUTF8(128), // boot file name
      magicCookie: sb.getUInt32(), // contains 99, 130, 83, 99
      options: sb.getOptions()
    };
  },

  format: function(data) {

    const sb = new SeqBuffer;

    sb.addUInt8(data.op);
    sb.addUInt8(data.htype);
    sb.addUInt8(data.hlen);
    sb.addUInt8(data.hops);
    sb.addUInt32(data.xid);
    sb.addUInt16(data.secs);
    sb.addUInt16(data.flags);
    sb.addIP(data.ciaddr);
    sb.addIP(data.yiaddr);
    sb.addIP(data.siaddr);
    sb.addIP(data.giaddr);
    sb.addMac(data.chaddr);
    sb.addUTF8Pad(data.sname, 64);
    sb.addUTF8Pad(data.file, 128);
    sb.addUInt32(0x63825363);
    sb.addOptions(data.options);

    sb.addUInt8(255); // Mark end

    // TODO: Must options packet be >= 68 byte and 4 byte alligned?

    return sb;
  }

};
