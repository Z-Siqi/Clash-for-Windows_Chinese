var Utils = require('./utils')

var BLOCK_CHAR = {
  WW: ' ',
  WB: '▄',
  BB: '█',
  BW: '▀'
}

var INVERTED_BLOCK_CHAR = {
  BB: ' ',
  BW: '▄',
  WW: '█',
  WB: '▀'
}

function getBlockChar (top, bottom, blocks) {
  if (top && bottom) return blocks.BB
  if (top && !bottom) return blocks.BW
  if (!top && bottom) return blocks.WB
  return blocks.WW
}

exports.render = function (qrData, options, cb) {
  var opts = Utils.getOptions(options)
  var blocks = BLOCK_CHAR
  if (opts.color.dark.hex === '#ffffff' || opts.color.light.hex === '#000000') {
    blocks = INVERTED_BLOCK_CHAR
  }

  var size = qrData.modules.size
  var data = qrData.modules.data

  var output = ''
  var hMargin = Array(size + (opts.margin * 2) + 1).join(blocks.WW)
  hMargin = Array((opts.margin / 2) + 1).join(hMargin + '\n')

  var vMargin = Array(opts.margin + 1).join(blocks.WW)

  output += hMargin
  for (var i = 0; i < size; i += 2) {
    output += vMargin
    for (var j = 0; j < size; j++) {
      var topModule = data[i * size + j]
      var bottomModule = data[(i + 1) * size + j]

      output += getBlockChar(topModule, bottomModule, blocks)
    }

    output += vMargin + '\n'
  }

  output += hMargin.slice(0, -1)

  if (typeof cb === 'function') {
    cb(null, output)
  }

  return output
}

exports.renderToFile = function renderToFile (path, qrData, options, cb) {
  if (typeof cb === 'undefined') {
    cb = options
    options = undefined
  }

  var fs = require('fs')
  var utf8 = exports.render(qrData, options)
  fs.writeFile(path, utf8, cb)
}
