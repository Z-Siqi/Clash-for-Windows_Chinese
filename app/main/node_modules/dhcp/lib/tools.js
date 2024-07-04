

module.exports = {

  parseIp: function (str) {
    const octs = str.split(".");

    if (octs.length !== 4) {
      throw new Error('Invalid IP address ' + str);
    }

    return octs.reduce(function (prev, val) {
      val = parseInt(val, 10);

      if (0 <= val && val < 256) {
        return (prev << 8) | val;
      } else {
        throw new Error('Invalid IP address ' + str);
      }
    }, 0);
  },
  formatIp: function (num) {
    let ip = "";

    for (let i = 24; i >= 0; i -= 8) {

      if (ip)
        ip += ".";

      ip += ((num >>> i) & 0xFF).toString(10);
    }
    return ip;
  },
  // Source: http://www.xarg.org/tools/subnet-calculator/
  netmaskFromCIDR: function (cidr) {
    return -1 << (32 - cidr);
  },
  netmaskFromIP: function (ip) {
    // we don't have much information, pick a class related netmask

    if (typeof ip === "string")
      ip = this.parseIp(ip);

    const first = ip >>> 24;

    if (first <= 127) {
      return 0xff000000;
    } else if (first >= 192) {
      return 0xffffff00;
    } else {
      return 0xffff0000;
    }
  },
  // Source: http://www.xarg.org/tools/subnet-calculator/
  wildcardFromCIDR: function (cidr) {
    return ~this.netmaskFromCIDR(cidr);
  },
  // Source: http://www.xarg.org/tools/subnet-calculator/
  networkFromIpCIDR: function (ip, cidr) {

    if (typeof ip === "string")
      ip = this.parseIp(ip);

    return this.netmaskFromCIDR(cidr) & ip;
  },
  // Source: http://www.xarg.org/tools/subnet-calculator/
  broadcastFromIpCIDR: function (ip, cidr) {

    if (typeof ip === "string")
      ip = this.parseIp(ip);

    return this.networkFromIpCIDR(ip, cidr) | this.wildcardFromCIDR(cidr);
  },
  // Source: http://www.xarg.org/tools/subnet-calculator/
  CIDRFromNetmask: function (net) {

    if (typeof net === "string")
      net = this.parseIp(net);

    let s = 0;
    let d = 0;
    let t = net & 1;
    let wild = t;
    for (let i = 0; i < 32; i++) {
      d += t ^ net & 1;
      t = net & 1;
      net >>>= 1;
      s += t;
    }
    if (d !== 1) {
      throw new Error('Invalid Netmask ' + net);
    }
    if (wild)
      s = 32 - s;
    return s;
  },
  // Source: http://www.xarg.org/tools/subnet-calculator/
  gatewayFromIpCIDR: function (ip, cidr) {

    // The gateway is not the first host of the network in general
    // But it's the best guess we can make.

    if (typeof ip === "string")
      ip = this.parseIp(ip);

    if (cidr === 32)
      return ip;

    return this.networkFromIpCIDR(ip, cidr) + 1;
  },
  // Source: http://www.xarg.org/tools/subnet-calculator/
  netmaskFromRange: function (ip1, ip2) {

    if (typeof ip1 === "string")
      ip1 = this.parseIp(ip1);

    if (typeof ip2 === "string")
      ip2 = this.parseIp(ip2);

    const cidr = 32 - Math.floor(Math.log2((ip1 ^ (ip2 - 1)) + 2)) - 1;

    return this.netmaskFromCIDR(cidr);
  }

};
