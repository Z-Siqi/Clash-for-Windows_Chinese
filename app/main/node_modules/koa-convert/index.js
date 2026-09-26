'use strict'

/**
 * Module dependencies.
 */

const co = require('co')
const compose = require('koa-compose')

/**
 * Expose `convert()`.
 */

module.exports = convert

/**
 * Convert Koa legacy generator-based middleware
 * to modern promise-based middleware.
 *
 *
 * @api public
 * */

function convert (mw) {
  if (typeof mw !== 'function') {
    throw new TypeError('middleware must be a function')
  }

  // assume it's Promise-based middleware
  if (
    mw.constructor.name !== 'GeneratorFunction' &&
    mw.constructor.name !== 'AsyncGeneratorFunction'
  ) {
    return mw
  }

  const converted = function (ctx, next) {
    return co.call(
      ctx,
      mw.call(
        ctx,
        (function * (next) { return yield next() })(next)
      ))
  }

  converted._name = mw._name || mw.name
  return converted
}

/**
 * Convert and compose multiple middleware
 * (could mix legacy and modern ones)
 * and return modern promise middleware.
 *
 *
 * @api public
 * */

// convert.compose(mw, mw, mw)
// convert.compose([mw, mw, mw])
convert.compose = function (arr) {
  if (!Array.isArray(arr)) {
    arr = Array.from(arguments)
  }

  return compose(arr.map(convert))
}

/**
 * Convert Koa modern promise-based middleware
 * to legacy generator-based middleware.
 *
 *
 * @api public
 * */

convert.back = function (mw) {
  if (typeof mw !== 'function') {
    throw new TypeError('middleware must be a function')
  }

  // assume it's generator middleware
  if (mw.constructor.name === 'GeneratorFunction' || mw.constructor.name === 'AsyncGeneratorFunction') {
    return mw
  }

  const converted = function * (next) {
    const ctx = this
    let called = false

    yield mw(ctx, function () {
      if (called) {
        // guard against multiple next() calls
        // https://github.com/koajs/compose/blob/4e3e96baf58b817d71bd44a8c0d78bb42623aa95/index.js#L36
        throw new Error('next() called multiple times')
      }

      called = true
      return co.call(ctx, next)
    })
  }

  converted._name = mw._name || mw.name
  return converted
}
