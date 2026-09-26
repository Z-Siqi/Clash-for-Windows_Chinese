# koa-convert

[![Build Status][travis-img]][travis-url]
[![NPM version][npm-badge]][npm-url]
[![License][license-badge]][license-url]
![Code Size][code-size-badge]

<!-- [![Coverage Status][coverage-img]][coverage-url] -->

<!-- ***************** -->

[travis-img]: https://travis-ci.org/koajs/convert.svg?branch=master
[travis-url]: https://travis-ci.org/koajs/convert

<!-- 
  WAIT FOR ACCESS 
  [coverage-img]: https://coveralls.io/repos/github/koajs/convert/badge.svg?branch=master
  [coverage-url]: https://coveralls.io/github/koajs/convert?branch=master
-->

[npm-badge]: https://img.shields.io/npm/v/koa-better-request-id.svg?style=flat
[npm-url]: https://www.npmjs.com/package/koa-better-request-id
[license-badge]: https://img.shields.io/badge/license-MIT-green.svg?style=flat-square
[license-url]: https://github.com/koajs/koa-convert/blob/master/LICENSE
[code-size-badge]: https://img.shields.io/github/languages/code-size/koajs/koa-convert

<!-- ***************** -->

Convert Koa legacy (0.x & 1.x) generator middleware to modern promise middleware (2.x).

It could also convert modern promise middleware back to legacy generator middleware (useful to help modern middleware support Koa v0.x or v1.x).

## Note

Router middleware is special case here. Because it reimplements middleware composition internally, we cannot not simply convert it.

You may use following packages for [routing](https://github.com/koajs/koa/wiki#routing-and-mounting), which are koa 2.x ready now:

* [koa-route@3.0.0](https://github.com/koajs/route/tree/next)
* [koa-simple-router](https://github.com/gyson/koa-simple-router)
* [koa-router@next](https://github.com/alexmingoia/koa-router/tree/master)
* [koa-66](https://github.com/menems/koa-66)

## Installation

```bash
# npm ..
$ npm i koa-convert
# yarn ..
$ yarn add koa-convert
```

## Usage

```js
const Koa = require('koa') // koa v2.x
const convert = require('koa-convert')
const app = new Koa()

app.use(modernMiddleware)

app.use(convert(legacyMiddleware))

app.use(convert.compose(legacyMiddleware, modernMiddleware))

function * legacyMiddleware (next) {
  // before
  yield next
  // after
}

function modernMiddleware (ctx, next) {
  // before
  return next().then(() => {
    // after
  })
}
```

## Distinguish legacy and modern middleware

In koa 0.x and 1.x (without experimental flag), `app.use` has an assertion that all (legacy) middleware must be generator function and it's tested with `fn.constructor.name == 'GeneratorFunction'` at [here](https://github.com/koajs/koa/blob/7fe29d92f1e826d9ce36029e1b9263b94cba8a7c/lib/application.js#L105).

Therefore, we can distinguish legacy and modern middleware with `fn.constructor.name == 'GeneratorFunction'`.

## Migration

`app.use(legacyMiddleware)` is everywhere in 0.x and 1.x and it would be painful to manually change all of them to `app.use(convert(legacyMiddleware))`.

You can use following snippet to make migration easier.

```js
const _use = app.use
app.use = x => _use.call(app, convert(x))
```

The above snippet will override `app.use` method and implicitly convert all legacy generator middleware to modern promise middleware.

Therefore, you can have both `app.use(modernMiddleware)` and `app.use(legacyMiddleware)` and your 0.x or 1.x should work without modification.

Complete example:

```js
const Koa = require('koa') // v2.x
const convert = require('koa-convert')
const app = new Koa()

// ---------- override app.use method ----------

const _use = app.use
app.use = x => _use.call(app, convert(x))

// ---------- end ----------

app.use(modernMiddleware)

// this will be converted to modern promise middleware implicitly
app.use(legacyMiddleware)

function * legacyMiddleware (next) {
  // before
  yield next
  // after
}

function modernMiddleware (ctx, next) {
  // before
  return next().then(() => {
    // after
  })
}
```

## API

#### `convert()`

Convert legacy generator middleware to modern promise middleware.

```js
modernMiddleware = convert(legacyMiddleware)
```

#### `convert.compose()`

Convert and compose multiple middleware (could mix legacy and modern ones) and return modern promise middleware.

```js
composedModernMiddleware = convert.compose(legacyMiddleware, modernMiddleware)
// or
composedModernMiddleware = convert.compose([legacyMiddleware, modernMiddleware])
```

#### `convert.back()`

Convert modern promise middleware back to legacy generator middleware.

This is useful to help modern promise middleware support koa 0.x or 1.x.

```js
legacyMiddleware = convert.back(modernMiddleware)
```

## License

[MIT](LICENSE)
