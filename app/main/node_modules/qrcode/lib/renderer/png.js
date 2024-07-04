var fs = require('fs')
var PNG = require('pngjs').PNG
var Utils = require('./utils')

exports.render = function render (qrData, options) {
  var opts = Utils.getOptions(options)
  var pngOpts = opts.rendererOpts
  var size = Utils.getImageWidth(qrData.modules.size, opts)

  pngOpts.width = size
  pngOpts.height = size

  var pngImage = new PNG(pngOpts)
  Utils.qrToImageData(pngImage.data, qrData, opts)

  return pngImage
}

exports.renderToDataURL = function renderToDataURL (qrData, options, cb) {
  if (typeof cb === 'undefined') {
    cb = options
    options = undefined
  }

  exports.renderToBuffer(qrData, options, function (err, output) {
    if (err) cb(err)
    var url = 'data:image/png;base64,'
    url += output.toString('base64')
    cb(null, url)
  })
}

exports.renderToBuffer = function renderToBuffer (qrData, options, cb) {
  if (typeof cb === 'undefined') {
    cb = options
    options = undefined
  }

  var png = exports.render(qrData, options)
  var buffer = []

  png.on('error', cb)

  png.on('data', function (data) {
    buffer.push(data)
  })

  png.on('end', function () {
    cb(null, Buffer.concat(buffer))
  })

  png.pack()
}

exports.renderToFile = function renderToFile (path, qrData, options, cb) {
  if (typeof cb === 'undefined') {
    cb = options
    options = undefined
  }

  var stream = fs.createWriteStream(path)
  stream.on('error', cb)
  stream.on('close', cb)

  exports.renderToFileStream(stream, qrData, options)
}

exports.renderToFileStream = function renderToFileStream (stream, qrData, options) {
  var png = exports.render(qrData, options)
  png.pack().pipe(stream)
}
