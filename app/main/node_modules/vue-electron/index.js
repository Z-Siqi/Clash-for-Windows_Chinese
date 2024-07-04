module.exports = {
  install: function (Vue) {
    Vue.prototype.$electron = require('electron')
  }
}
