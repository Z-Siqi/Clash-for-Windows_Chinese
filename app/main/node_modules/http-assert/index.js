var createError = require('http-errors')
var eql = require('deep-equal')

module.exports = assert

function assert (value, status, msg, opts) {
  if (value) return
  throw createError(status, msg, opts)
}

assert.equal = function (a, b, status, msg, opts) {
  assert(a == b, status, msg, opts) // eslint-disable-line eqeqeq
}

assert.notEqual = function (a, b, status, msg, opts) {
  assert(a != b, status, msg, opts) // eslint-disable-line eqeqeq
}

assert.ok = function (value, status, msg, opts) {
  assert(value, status, msg, opts)
}

assert.strictEqual = function (a, b, status, msg, opts) {
  assert(a === b, status, msg, opts)
}

assert.notStrictEqual = function (a, b, status, msg, opts) {
  assert(a !== b, status, msg, opts)
}

assert.deepEqual = function (a, b, status, msg, opts) {
  assert(eql(a, b), status, msg, opts)
}

assert.notDeepEqual = function (a, b, status, msg, opts) {
  assert(!eql(a, b), status, msg, opts)
}
