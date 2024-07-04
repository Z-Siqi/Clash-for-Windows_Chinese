0.8.0 / 2019-10-11
==================

  * Fix check for default `secure` option behavior
  * Fix `maxAge` option preventing cookie deletion
  * Support `"none"` in `sameSite` option
  * deps: depd@~2.0.0
    - Replace internal `eval` usage with `Function` constructor
    - Use instance methods on `process` to check for listeners
  * deps: keygrip@~1.1.0
    - Use `tsscmp` module for timing-safe signature verification

0.7.3 / 2018-11-04
==================

  * deps: keygrip@~1.0.3
    - perf: enable strict mode

0.7.2 / 2018-09-09
==================

  * deps: depd@~1.1.2
  * perf: remove argument reassignment

0.7.1 / 2017-08-26
==================

  * deps: depd@~1.1.1
    - Remove unnecessary `Buffer` loading
  * deps: keygrip@~1.0.2
    - perf: improve comparison speed

0.7.0 / 2017-02-19
==================

  * Add `sameSite` option for SameSite cookie support
  * pref: enable strict mode

0.6.2 / 2016-11-12
==================

  * Fix `keys` deprecation message
  * deps: keygrip@~1.0.1

0.6.1 / 2016-02-29
==================

  * Fix regression in 0.6.0 for array of strings in `keys` option

0.6.0 / 2016-02-29
==================

  * Add `secure` constructor option for secure connection checking
  * Change constructor to signature `new Cookies(req, res, [options])`
    - Replace `new Cookies(req, res, key)` with `new Cookies(req, res, {'keys': keys})`
  * Change prototype construction for proper "constructor" property
  * Deprecate `secureProxy` option in `.set`; use `secure` option instead
    - If `secure: true` throws even over SSL, use the `secure` constructor option

0.5.1 / 2014-07-27
==================

  * Throw on invalid values provided to `Cookie` constructor
    - This is not strict validation, but basic RFC 7230 validation

0.5.0 / 2014-07-27
==================

  * Integrate with `req.protocol` for secure cookies
  * Support `maxAge` as well as `maxage`

0.4.1 / 2014-05-07
==================

  * Update package for repo move

0.4.0 / 2014-01-31
==================

  * Allow passing an array of strings as keys

0.3.8-0.2.0
===========

  * TODO: write down history for these releases

0.1.6 / 2011-03-01
==================

  * SSL cookies secure by default
  * Use httpOnly by default unless explicitly false

0.1.5 / 2011-02-26
==================

  * Delete sig cookie if signed cookie is deleted

0.1.4 / 2011-02-26
==================

  * Always set path

0.1.3 / 2011-02-26
==================

  * Add sensible defaults for path

0.1.2 / 2011-02-26
==================

  * Inherit cookie properties to signature cookie

0.1.1 / 2011-02-25
==================

  * Readme updates

0.1.0 / 2011-02-25
==================

  * Initial release
