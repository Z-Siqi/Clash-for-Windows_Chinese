# keygrip

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

Keygrip is a [node.js](http://nodejs.org/) module for signing and verifying data (such as cookies or URLs) through a rotating credential system, in which new server keys can be added and old ones removed regularly, without invalidating client credentials.

## Install

    $ npm install keygrip

## API

### keys = new Keygrip([keylist], [hmacAlgorithm], [encoding])

This creates a new Keygrip based on the provided keylist, an array of secret keys used for SHA1 HMAC digests. `keylist` is obligatory. `hmacAlgorithm` defaults to `'sha1'` and `encoding` defaults to `'base64'`.

Note that the `new` operator is also optional, so all of the following will work when `Keygrip = require("keygrip")`:

```javascript
keys = new Keygrip(["SEKRIT2", "SEKRIT1"])
keys = Keygrip(["SEKRIT2", "SEKRIT1"])
keys = require("keygrip")()
keys = Keygrip(["SEKRIT2", "SEKRIT1"], 'sha256', 'hex')
keys = Keygrip(["SEKRIT2", "SEKRIT1"], 'sha256')
keys = Keygrip(["SEKRIT2", "SEKRIT1"], undefined, 'hex')
```

The keylist is an array of all valid keys for signing, in descending order of freshness; new keys should be `unshift`ed into the array and old keys should be `pop`ped.

The tradeoff here is that adding more keys to the keylist allows for more granular freshness for key validation, at the cost of a more expensive worst-case scenario for old or invalid hashes.

Keygrip keeps a reference to this array to automatically reflect any changes. This reference is stored using a closure to prevent external access.

### keys.sign(data)

This creates a SHA1 HMAC based on the _first_ key in the keylist, and outputs it as a 27-byte url-safe base64 digest (base64 without padding, replacing `+` with `-` and `/` with `_`).

### keys.index(data, digest)

This loops through all of the keys currently in the keylist until the digest of the current key matches the given digest, at which point the current index is returned. If no key is matched, `-1` is returned.

The idea is that if the index returned is greater than `0`, the data should be re-signed to prevent premature credential invalidation, and enable better performance for subsequent challenges.

### keys.verify(data, digest)

This uses `index` to return `true` if the digest matches any existing keys, and `false` otherwise.

## Example

```javascript
// ./test.js
var assert = require("assert")
  , Keygrip = require("keygrip")
  , keylist, keys, hash, index

// but we're going to use our list.
// (note that the 'new' operator is optional)
keylist = ["SEKRIT3", "SEKRIT2", "SEKRIT1"]
keys = Keygrip(keylist)
// .sign returns the hash for the first key
// all hashes are SHA1 HMACs in url-safe base64
hash = keys.sign("bieberschnitzel")
assert.ok(/^[\w\-]{27}$/.test(hash))

// .index returns the index of the first matching key
index = keys.index("bieberschnitzel", hash)
assert.equal(index, 0)

// .verify returns the a boolean indicating a matched key
matched = keys.verify("bieberschnitzel", hash)
assert.ok(matched)

index = keys.index("bieberschnitzel", "o_O")
assert.equal(index, -1)

// rotate a new key in, and an old key out
keylist.unshift("SEKRIT4")
keylist.pop()

// if index > 0, it's time to re-sign
index = keys.index("bieberschnitzel", hash)
assert.equal(index, 1)
hash = keys.sign("bieberschnitzel")
```

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/keygrip.svg
[npm-url]: https://npmjs.org/package/keygrip
[travis-image]: https://img.shields.io/travis/crypto-utils/keygrip/master.svg
[travis-url]: https://travis-ci.org/crypto-utils/keygrip
[coveralls-image]: https://img.shields.io/coveralls/crypto-utils/keygrip/master.svg
[coveralls-url]: https://coveralls.io/r/crypto-utils/keygrip
[downloads-image]: https://img.shields.io/npm/dm/keygrip.svg
[downloads-url]: https://npmjs.org/package/keygrip
[node-version-image]: https://img.shields.io/node/v/keygrip.svg
[node-version-url]: https://nodejs.org/en/download/
