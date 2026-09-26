Cookies
=======

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![Build Status][ci-image]][ci-url]
[![Test Coverage][coveralls-image]][coveralls-url]

Cookies is a [node.js](http://nodejs.org/) module for getting and setting HTTP(S) cookies. Cookies can be signed to prevent tampering, using [Keygrip](https://www.npmjs.com/package/keygrip). It can be used with the built-in node.js HTTP library, or as Connect/Express middleware.

## Install

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/). Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```
$ npm install cookies
```

## Features

* **Lazy**: Since cookie verification against multiple keys could be expensive, cookies are only verified lazily when accessed, not eagerly on each request.

* **Secure**: All cookies are `httponly` by default, and cookies sent over SSL are `secure` by default. An error will be thrown if you try to send secure cookies over an insecure socket.

* **Unobtrusive**: Signed cookies are stored the same way as unsigned cookies, instead of in an obfuscated signing format. An additional signature cookie is stored for each signed cookie, using a standard naming convention (_cookie-name_`.sig`). This allows other libraries to access the original cookies without having to know the signing mechanism.

* **Agnostic**: This library is optimized for use with [Keygrip](https://www.npmjs.com/package/keygrip), but does not require it; you can implement your own signing scheme instead if you like and use this library only to read/write cookies. Factoring the signing into a separate library encourages code reuse and allows you to use the same signing library for other areas where signing is needed, such as in URLs.

## API

### new Cookies(request, response [, options])

Create a new cookie jar for a given `request` and `response` pair. The `request` argument is a [Node.js HTTP incoming request object](https://nodejs.org/dist/latest-v16.x/docs/api/http.html#class-httpincomingmessage) and the `response` argument is a [Node.js HTTP server response object](https://nodejs.org/dist/latest-v16.x/docs/api/http.html#class-httpserverresponse).

A [Keygrip](https://www.npmjs.com/package/keygrip) object or an array of keys can optionally be passed as `options.keys` to enable cryptographic signing based on SHA1 HMAC, using rotated credentials.

A Boolean can optionally be passed as `options.secure` to explicitally specify if the connection is secure, rather than this module examining `request`.

Note that since this only saves parameters without any other processing, it is very lightweight. Cookies are only parsed on demand when they are accessed.

### Cookies.express(keys)

This adds cookie support as a Connect middleware layer for use in Express apps, allowing inbound cookies to be read using `req.cookies.get` and outbound cookies to be set using `res.cookies.set`.

### cookies.get(name [, options])

This extracts the cookie with the given name from the `Cookie` header in the request. If such a cookie exists, its value is returned. Otherwise, nothing is returned.

`{ signed: true }` can optionally be passed as the second parameter _options_. In this case, a signature cookie (a cookie of same name ending with the `.sig` suffix appended) is fetched. If no such cookie exists, nothing is returned.

If the signature cookie _does_ exist, the provided [Keygrip](https://www.npmjs.com/package/keygrip) object is used to check whether the hash of _cookie-name_=_cookie-value_ matches that of any registered key:

* If the signature cookie hash matches the first key, the original cookie value is returned.
* If the signature cookie hash matches any other key, the original cookie value is returned AND an outbound header is set to update the signature cookie's value to the hash of the first key. This enables automatic freshening of signature cookies that have become stale due to key rotation.
* If the signature cookie hash does not match any key, nothing is returned, and an outbound header with an expired date is used to delete the cookie.

### cookies.set(name [, values [, options]])

This sets the given cookie in the response and returns the current context to allow chaining.

If the _value_ is omitted, an outbound header with an expired date is used to delete the cookie.

If the _options_ object is provided, it will be used to generate the outbound cookie header as follows:

* `maxAge`: a number representing the milliseconds from `Date.now()` for expiry
* `expires`: a `Date` object indicating the cookie's expiration date (expires at the end of session by default).
* `path`: a string indicating the path of the cookie (`/` by default).
* `domain`: a string indicating the domain of the cookie (no default).
* `secure`: a boolean indicating whether the cookie is only to be sent over HTTPS (`false` by default for HTTP, `true` by default for HTTPS). [Read more about this option below](#secure-cookies).
* `httpOnly`: a boolean indicating whether the cookie is only to be sent over HTTP(S), and not made available to client JavaScript (`true` by default).
* `partitioned`: a boolean indicating whether to partition the cookie in Chrome for the [CHIPS Update](https://developers.google.com/privacy-sandbox/3pcd/chips) (`false` by default). If this is true, Cookies from embedded sites will be partitioned and only readable from the same top level site from which it was created.
* `priority`: a string indicating the cookie priority. This can be set to `'low'`, `'medium'`, or `'high'`.
* `sameSite`: a boolean or string indicating whether the cookie is a "same site" cookie (`false` by default). This can be set to `'strict'`, `'lax'`, `'none'`, or `true` (which maps to `'strict'`).
* `signed`: a boolean indicating whether the cookie is to be signed (`false` by default). If this is true, another cookie of the same name with the `.sig` suffix appended will also be sent, with a 27-byte url-safe base64 SHA1 value representing the hash of _cookie-name_=_cookie-value_ against the first [Keygrip](https://www.npmjs.com/package/keygrip) key. This signature key is used to detect tampering the next time a cookie is received.
* `overwrite`: a boolean indicating whether to overwrite previously set cookies of the same name (`false` by default). If this is true, all cookies set during the same request with the same name (regardless of path or domain) are filtered out of the Set-Cookie header when setting this cookie.

### Secure cookies

To send a secure cookie, you set a cookie with the `secure: true` option.

HTTPS is necessary for secure cookies. When `cookies.set` is called with `secure: true` and a secure connection is not detected, the cookie will not be set and an error will be thrown.

This module will test each request to see if it's secure by checking:

* if the `protocol` property of the request is set to `https`, or
* if the `connection.encrypted` property of the request is set to `true`.

If your server is running behind a proxy and you are using `secure: true`, you need to configure your server to read the request headers added by your proxy to determine whether the request is using a secure connection.

For more information about working behind proxies, consult the framework you are using:

* For Koa - [`app.proxy = true`](http://koajs.com/#settings)
* For Express - [trust proxy setting](http://expressjs.com/en/4x/api.html#trust.proxy.options.table)

If your Koa or Express server is properly configured, the `protocol` property of the request will be set to match the protocol reported by the proxy in the `X-Forwarded-Proto` header.

## Example

```js
var http = require('http')
var Cookies = require('cookies')

// Optionally define keys to sign cookie values
// to prevent client tampering
var keys = ['keyboard cat']

var server = http.createServer(function (req, res) {
  // Create a cookies object
  var cookies = new Cookies(req, res, { keys: keys })

  // Get a cookie
  var lastVisit = cookies.get('LastVisit', { signed: true })

  // Set the cookie to a value
  cookies.set('LastVisit', new Date().toISOString(), { signed: true })

  if (!lastVisit) {
    res.setHeader('Content-Type', 'text/plain')
    res.end('Welcome, first time visitor!')
  } else {
    res.setHeader('Content-Type', 'text/plain')
    res.end('Welcome back! Nothing much changed since your last visit at ' + lastVisit + '.')
  }
})

server.listen(3000, function () {
  console.log('Visit us at http://127.0.0.1:3000/ !')
})
```

## License

[MIT](LICENSE)

[ci-image]: https://badgen.net/github/checks/pillarjs/cookies/master?label=ci
[ci-url]: https://github.com/pillarjs/cookies/actions/workflows/ci.yml
[npm-image]: https://img.shields.io/npm/v/cookies.svg
[npm-url]: https://npmjs.org/package/cookies
[node-version-image]: https://img.shields.io/node/v/cookies.svg
[node-version-url]: http://nodejs.org/download/
[coveralls-image]: https://img.shields.io/coveralls/pillarjs/cookies/master.svg
[coveralls-url]: https://coveralls.io/r/pillarjs/cookies?branch=master
[downloads-image]: https://img.shields.io/npm/dm/cookies.svg
[downloads-url]: https://npmjs.org/package/cookies
