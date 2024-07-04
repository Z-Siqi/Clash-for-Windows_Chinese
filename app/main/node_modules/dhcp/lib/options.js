
/**
 * Format:
 * name: A string description of the option
 * type: A type, which is used by SeqBuffer to parse the option
 * config: The name of the configuration option
 * attr: When a client sends data and an option has no configuration, this is the attribute name for the option
 * default: Gets passed if no configuration is supplied for the option (can be a value or a function)
 * enum: Represents a map of possible enum for this option
 */

const Tools = require('./tools.js');

// RFC 1533: https://tools.ietf.org/html/rfc1533
// RFC 2132: https://www.ietf.org/rfc/rfc2132.txt
// RFC 3011: https://tools.ietf.org/html/rfc3011
const opts = {
  1: {// RFC 2132
    name: 'Subnet Mask',
    type: 'IP',
    config: 'netmask',
    default: function() {

      // Default is the minimal CIDR for the given range

      const range = this.config('range');

      const net = Tools.netmaskFromRange(range[0], range[1]);

      return Tools.formatIp(net);
    }
  },
  2: {// RFC 2132
    name: 'Time Offset',
    type: 'Int32',
    config: 'timeOffset'
  },
  3: {// RFC 2132
    name: 'Router',
    type: 'IPs',
    config: 'router',
    default: function() {

      // Let's assume the router is the first host of the range if we don't know better
      // Maybe we should calculate the actual host of the subnet instead of assuming the user made it right

      const range = this.config('range');

      return range[0];
    }
  },
  4: {// RFC 2132
    name: 'Time Server',
    type: 'IPs',
    config: 'timeServer'
  },
  5: {
    name: 'Name Server',
    type: 'IPs',
    config: 'nameServer'
  },
  6: {// RFC 2132
    name: 'Domain Name Server',
    type: 'IPs',
    config: 'dns',
    default: ['8.8.8.8', '8.8.4.4'] // Use Google DNS server as default
  },
  7: {// RFC 2132
    name: 'Log Server',
    type: 'IPs',
    config: 'logServer'
  },
  8: {
    name: 'Cookie Server',
    type: 'IPs',
    config: 'cookieServer'
  },
  9: {
    name: 'LPR Server',
    type: 'IPs',
    config: 'lprServer'
  },
  10: {
    name: 'Impress Server',
    type: 'IPs',
    config: 'impressServer'
  },
  11: {
    name: 'Resource Location Server',
    type: 'IPs',
    config: 'rscServer'
  },
  12: {// RFC 2132
    name: 'Host Name',
    type: 'ASCII',
    config: 'hostname'
  },
  13: {
    name: 'Boot File Size',
    type: 'UInt16',
    config: 'bootFileSize'
  },
  14: {
    name: 'Merit Dump File',
    type: 'ASCII',
    config: 'dumpFile'
  },
  15: {// RFC 2132
    name: 'Domain Name',
    type: 'ASCII',
    config: 'domainName'
  },
  16: {
    name: 'Swap Server',
    type: 'IP',
    config: 'swapServer'
  },
  17: {
    name: 'Root Path',
    type: 'ASCII',
    config: 'rootPath'
  },
  18: {
    name: 'Extension Path',
    type: 'ASCII',
    config: 'extensionPath'
  },
  19: {
    name: 'IP Forwarding', // Force client to enable ip forwarding
    type: 'UInt8',
    config: 'ipForwarding',
    enum: {
      0: 'Disabled',
      1: 'Enabled'
    }
  },
  20: {
    name: 'Non-Local Source Routing',
    type: 'Bool',
    config: 'nonLocalSourceRouting'
  },
  21: {
    name: 'Policy Filter',
    type: 'IPs',
    config: 'policyFilter'
  },
  22: {
    name: 'Maximum Datagram Reassembly Size',
    type: 'UInt16',
    config: 'maxDatagramSize'
  },
  23: {
    name: 'Default IP Time-to-live',
    type: 'UInt8',
    config: 'datagramTTL'
  },
  24: {
    name: 'Path MTU Aging Timeout',
    type: 'UInt32',
    config: 'mtuTimeout'
  },
  25: {
    name: 'Path MTU Plateau Table',
    type: 'UInt16s',
    config: 'mtuSizes'
  },
  26: {
    name: 'Interface MTU',
    type: 'UInt16',
    config: 'mtuInterface'
  },
  27: {
    name: 'All Subnets are Local',
    type: 'UInt8',
    config: 'subnetsAreLocal',
    enum: {
      0: 'Disabled',
      1: 'Enabled'
    }
  },
  28: {
    name: 'Broadcast Address',
    type: 'IP',
    config: 'broadcast',
    default: function() {

      const range = this.config('range');
      const ip = range[0]; // range begin is obviously a valid ip
      const cidr = Tools.CIDRFromNetmask(this.config('netmask'));

      return Tools.formatIp(Tools.broadcastFromIpCIDR(ip, cidr));
    }
  },
  29: {
    name: 'Perform Mask Discovery',
    type: 'UInt8',
    config: 'maskDiscovery',
    enum: {
      0: 'Disabled',
      1: 'Enabled'
    }
  },
  30: {
    name: 'Mask Supplier',
    type: 'UInt8',
    config: 'maskSupplier',
    enum: {
      0: 'Disabled',
      1: 'Enabled'
    }
  },
  31: {
    name: 'Perform Router Discovery',
    type: 'UInt8',
    config: 'routerDiscovery',
    enum: {
      0: 'Disabled',
      1: 'Enabled'
    }
  },
  32: {
    name: 'Router Solicitation Address',
    type: 'IP',
    config: 'routerSolicitation'
  },
  33: {
    name: 'Static Route',
    type: 'IPs', // Always pairs of two must be provided, [destination1, route1, destination2, route2, ...]
    config: 'staticRoutes'
  },
  34: {
    name: 'Trailer Encapsulation',
    type: 'Bool',
    config: 'trailerEncapsulation'
  },
  35: {
    name: 'ARP Cache Timeout',
    type: 'UInt32',
    config: 'arpCacheTimeout'
  },
  36: {
    name: 'Ethernet Encapsulation',
    type: 'Bool',
    config: 'ethernetEncapsulation'
  },
  37: {
    name: 'TCP Default TTL',
    type: 'UInt8',
    config: 'tcpTTL'
  },
  38: {
    name: 'TCP Keepalive Interval',
    type: 'UInt32',
    config: 'tcpKeepalive'
  },
  39: {
    name: 'TCP Keepalive Garbage',
    type: 'Bool',
    config: 'tcpKeepaliveGarbage'
  },
  40: {
    name: 'Network Information Service Domain',
    type: 'ASCII',
    config: 'nisDomain'
  },
  41: {
    name: 'Network Information Servers',
    type: 'IPs',
    config: 'nisServer'
  },
  42: {
    name: 'Network Time Protocol Servers',
    type: 'IPs',
    config: 'ntpServer'
  },
  43: {// RFC 2132
    name: 'Vendor Specific Information',
    type: 'UInt8s',
    config: 'vendor'
  },
  44: {
    name: 'NetBIOS over TCP/IP Name Server',
    type: 'IPs',
    config: 'nbnsServer'
  },
  45: {
    name: 'NetBIOS over TCP/IP Datagram Distribution Server',
    type: 'IP',
    config: 'nbddServer'
  },
  46: {
    name: 'NetBIOS over TCP/IP Node Type',
    type: 'UInt8',
    enum: {
      0x1: 'B-node',
      0x2: 'P-node',
      0x4: 'M-node',
      0x8: 'H-node'
    },
    config: 'nbNodeType'
  },
  47: {
    name: 'NetBIOS over TCP/IP Scope',
    type: 'ASCII',
    config: 'nbScope'
  },
  48: {
    name: 'X Window System Font Server',
    type: 'IPs',
    config: 'xFontServer'
  },
  49: {
    name: 'X Window System Display Manager',
    type: 'IPs',
    config: 'xDisplayManager'
  },
  50: {// IP wish of client in DHCPDISCOVER
    name: 'Requested IP Address',
    type: 'IP',
    attr: 'requestedIpAddress'
  },
  51: {// RFC 2132
    name: 'IP Address Lease Time',
    type: 'UInt32',
    config: 'leaseTime',
    default: 86400
  },
  52: {
    name: 'Option Overload',
    type: 'UInt8',
    enum: {
      1: 'file',
      2: 'sname',
      3: 'both'
    }
  },
  53: {
    name: 'DHCP Message Type',
    type: 'UInt8',
    enum: {
      1: 'DHCPDISCOVER',
      2: 'DHCPOFFER',
      3: 'DHCPREQUEST',
      4: 'DHCPDECLINE',
      5: 'DHCPACK',
      6: 'DHCPNAK',
      7: 'DHCPRELEASE',
      8: 'DHCPINFORM'
    }
  },
  54: {
    name: 'Server Identifier',
    type: 'IP',
    config: 'server'
  },
  55: {// Sent by client to show all things the client wants
    name: 'Parameter Request List',
    type: 'UInt8s',
    attr: 'requestParameter'
  },
  56: {// Error message sent in DHCPNAK on failure
    name: 'Message',
    type: 'ASCII'
  },
  57: {
    name: 'Maximum DHCP Message Size',
    type: 'UInt16',
    config: 'maxMessageSize',
    default: 1500
  },
  58: {
    name: 'Renewal (T1) Time Value',
    type: 'UInt32',
    config: 'renewalTime',
    default: 3600
  },
  59: {
    name: 'Rebinding (T2) Time Value',
    type: 'UInt32',
    config: 'rebindingTime',
    default: 14400
  },
  60: {// RFC 2132: Sent by client to identify type of a client
    name: 'Vendor Class-Identifier',
    type: 'ASCII',
    attr: 'vendorClassId' // 'MSFT' (win98, Me, 2000), 'MSFT 98' (win 98, me), 'MSFT 5.0' (win 2000 and up), 'alcatel.noe.0' (alcatel IP touch phone), ...
  },
  61: {// Sent by client to specify their unique identifier, to be used to disambiguate the lease on the server
    name: 'Client-Identifier',
    type: 'ASCII',
    attr: 'clientId'
  },
  64: {
    name: 'Network Information Service+ Domain',
    type: 'ASCII',
    config: 'nisPlusDomain'
  },
  65: {
    name: 'Network Information Service+ Servers',
    type: 'IPs',
    config: 'nisPlusServer'
  },
  66: {// RFC 2132: PXE option
    name: 'TFTP server name',
    type: 'ASCII',
    config: 'tftpServer' // e.g. '192.168.0.1'
  },
  67: {// RFC 2132: PXE option
    name: 'Bootfile name',
    type: 'ASCII',
    config: 'bootFile' // e.g. 'pxelinux.0'
  },
  68: {
    name: 'Mobile IP Home Agent',
    type: 'ASCII',
    config: 'homeAgentAddresses'
  },
  69: {
    name: 'Simple Mail Transport Protocol (SMTP) Server',
    type: 'IPs',
    config: 'smtpServer'
  },
  70: {
    name: 'Post Office Protocol (POP3) Server',
    type: 'IPs',
    config: 'pop3Server'
  },
  71: {
    name: 'Network News Transport Protocol (NNTP) Server',
    type: 'IPs',
    config: 'nntpServer'
  },
  72: {
    name: 'Default World Wide Web (WWW) Server',
    type: 'IPs',
    config: 'wwwServer'
  },
  73: {
    name: 'Default Finger Server',
    type: 'IPs',
    config: 'fingerServer'
  },
  74: {
    name: 'Default Internet Relay Chat (IRC) Server',
    type: 'IPs',
    config: 'ircServer'
  },
  75: {
    name: 'StreetTalk Server',
    type: 'IPs',
    config: 'streetTalkServer'
  },
  76: {
    name: 'StreetTalk Directory Assistance (STDA) Server',
    type: 'IPs',
    config: 'streetTalkDAServer'
  },
  80: {// RFC 4039: http://www.networksorcery.com/enp/rfc/rfc4039.txt
    name: 'Rapid Commit',
    type: 'Bool',
    attr: 'rapidCommit'
  }, /*
   82: { // RFC 3046, relayAgentInformation
   
   },*/
  95: {
    name: 'LDAP Servers',
    type: 'IPs',
    config: 'ldapServer'
  },
  116: {// RFC 2563: https://tools.ietf.org/html/rfc2563
    name: 'Auto-Configure',
    type: 'UInt8',
    enum: {
      0: 'DoNotAutoConfigure',
      1: 'AutoConfigure'
    },
    attr: 'autoConfigure'
  },
  118: {// RFC 301
    name: 'Subnet Selection',
    type: 'IP',
    config: 'subnetSelection'
  },
  119: {// dns search list
    name: 'Domain Search List',
    type: 'ASCII',
    config: 'domainSearchList'
  },
  121: {// rfc 3442
    name: 'Classless Route Option Format',
    type: 'IPs',
    config: 'classlessRoute'
  },
  145: {// RFC 6704: https://tools.ietf.org/html/rfc6704
    name: 'Forcerenew Nonce',
    type: 'UInt8s',
    attr: 'renewNonce'
  },
  208: {// https://tools.ietf.org/html/rfc5071
    name: 'PXE Magic Option',
    type: 'UInt32',
    config: 'pxeMagicOption',
    default: 0xF100747E
  },
  209: {// https://tools.ietf.org/html/rfc5071
    name: 'PXE Config File',
    type: 'ASCII',
    config: 'pxeConfigFile'
  },
  210: {// https://tools.ietf.org/html/rfc5071
    name: 'PXE Path Prefix',
    type: 'ASCII',
    config: 'pxePathPrefix'
  },
  211: {// https://tools.ietf.org/html/rfc5071
    name: 'PXE Reboot Time',
    type: 'UInt32',
    config: 'pxeRebootTime'
  },
  249: {// https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-dhcpe/f9c19c79-1c7f-4746-b555-0c0fc523f3f9
    name: 'Microsoft Classless Static Route Option',
    type: 'ASCII',
    config: 'classlessStaticRoute'
  },
  252: {// https://en.wikipedia.org/wiki/Web_Proxy_Auto-Discovery_Protocol
    name: 'Web Proxy Auto-Discovery',
    type: 'ASCII',
    config: 'wpad'
  },
  1001: {// TODO: Fix my number!
    name: 'Static',
    config: 'static'
  },
  1002: {// TODO: Fix my number!
    name: 'Random IP',
    type: 'Bool',
    config: 'randomIP',
    default: true
  }
};

// Create inverse config/attr lookup map
const conf = {};
const attr = {};
function addOption(code, opt) {

  opts[code] = opt;

  if (opt.config) {
    conf[opt.config] = parseInt(code, 10);
  } else if (opt.attr) {
    conf[opt.attr] = parseInt(code, 10);
  }
}

for (let i in opts) {
  addOption(i, opts[i]);
}

module.exports = {
  opts: opts, // id -> config
  conf: conf, // conf option -> id
  attr: attr, // attr name -> id
  addOption: addOption
};
