
4.1.0 / 2018-05-22
==================

  * improve: reduce stack trace by removing useless function call (#95)

4.0.0 / 2017-04-12
==================

 * remove `any-promise` as a dependency

3.2.1 / 2016-10-26
==================

 * revert add variadric support #65 - introduced an unintended breaking change

3.2.0 / 2016-10-25
==================

 * fix #60 infinite loop when calling next https://github.com/koajs/compose/pull/61
 * add variadric support https://github.com/koajs/compose/pull/65

3.1.0 / 2016-03-17
==================

 * add linting w/ standard
 * use `any-promise` so that the promise engine is configurable

3.0.0 / 2015-10-19
==================

 * change middleware signature to `async (ctx, next) => await next()` for `koa@2`.
   See https://github.com/koajs/compose/pull/27 for more information.

2.3.0 / 2014-05-01
==================

 * remove instrumentation

2.2.0 / 2014-01-22
==================

 * add `fn._name` for debugging

2.1.0 / 2013-12-22
==================

 * add debugging support
 * improve performance ~15%

2.0.1 / 2013-12-21
==================

  * update co to v3
  * use generator delegation

2.0.0 / 2013-11-07
==================

  * change middleware signature expected
