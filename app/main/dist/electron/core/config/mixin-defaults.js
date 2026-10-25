"use strict";

const DEFAULT_YAML_MIXIN = `mixin: # object
  dns:
    enable: true
    listen: :53
    enhanced-mode: fake-ip
    nameserver:
      - 8.8.8.8
    fallback:
      - 8.8.4.4
    fake-ip-filter:
      - +.stun.*.*
      - +.stun.*.*.*
      - +.stun.*.*.*.*
      - +.stun.*.*.*.*.*
      - "*.n.n.srv.nintendo.net"
      - +.stun.playstation.net
      - xbox.*.*.microsoft.com
      - "*.*.xboxlive.com"
      - "*.msftncsi.com"
      - "*.msftconnecttest.com"
      - WORKGROUP
`;

const DEFAULT_CODE_MIXIN = `module.exports.parse = ({ content, name, url }, { yaml, axios, notify }) => {
  return content
}`;

module.exports = { DEFAULT_YAML_MIXIN, DEFAULT_CODE_MIXIN };
