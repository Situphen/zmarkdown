const visit = require('unist-util-visit')
const fs = require('fs')
const path = require('path')
const request = require('request-promise')
const shortid = require('shortid')
const url = require('url')

const noop = Promise.resolve()

const requestParser = (body, response, resolveWithFullResponse) =>
  ({response: response, body: body})

const writeFile = (file, data, options) => new Promise((resolve, reject) => {
  const cb = (err) => {
    if (err) reject(err)
    resolve()
  }

  if (options) {
    fs.writeFile(file, data, options, cb)
  } else {
    fs.writeFile(file, data, cb)
  }
})

const mkdir = (path) => new Promise((resolve, reject) => {
  fs.stat(path, (err, stats) => {
    if (err) {
      return fs.mkdir(path, (err) => {
        if (err) reject(new Error(`Failed to create dir ${path}`))
        resolve()
      })
    }

    if (!stats.isDirectory()) {
      reject(new Error(`${path} is not a directory!`))
    }

    resolve()
  })
})

function plugin ({
  disabled = false,
  maxFileSize = 1000000,
  dirSizeLimit = 10000000,
  downloadDestination = './',
  report = console.error
} = {}) {
  return function transform (tree) {
    if (disabled) return noop
    let totalDownloadedSize

    // images are downloaded in destinationPath
    const destinationPath = path.join(downloadDestination, shortid.generate())

    return mkdir(destinationPath)
      .then(() => {
        totalDownloadedSize = 0
        const promises = [noop]

        visit(tree, 'image', function (node) {
          const parsedURI = url.parse(node.url)

          if (!parsedURI.host) return

          const extension = path.extname(parsedURI.pathname)
          const basename = `${shortid.generate()}${extension}`
          const destination = path.join(destinationPath, basename)
          const imageURL = node.url

          promises.push(
            isDownloadable(imageURL)
              .then(() => request({uri: imageURL, transform: requestParser}))
              .then(({body}) => writeFile(destination, body))
              .then(() => {
                node.url = destination
              })
              .catch((err) => report(err)))
        })

        return Promise.all(promises)
      })
      .catch((err) => report(err))
      .then(() => tree)

    function isDownloadable (uri) {
      return request.head({uri: uri, transform: requestParser})
        .then(({response}) => new Promise((resolve, reject) => {
          if (response.headers['content-type'].substring(0, 6) !== 'image/') {
            reject(new Error(`Content-Type of ${uri} is not of image/ type`))
          }

          const fileSize = parseInt(response.headers['content-length'], 10)

          if (maxFileSize && fileSize > maxFileSize) {
            reject(new Error(
              `File at ${uri} weighs ${response.headers['content-length']}, ` +
              `max size is ${maxFileSize}`))
          }

          if (dirSizeLimit && (totalDownloadedSize + fileSize) >= dirSizeLimit) {
            reject(new Error(
              `Cannot download ${uri} because destination directory reached size limit`))
          }

          totalDownloadedSize += fileSize
          resolve()
        }))
    }
  }
}

module.exports = plugin
