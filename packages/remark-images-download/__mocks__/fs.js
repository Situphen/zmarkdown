const fs = jest.genMockFromModule('fs') // eslint-disable-line no-undef

fs.stat = (path, callback) => {
  const err = null
  const stats = {
    isDirectory () {
      return true
    }
  }
  process.nextTick(() => callback(err, stats))
}

fs.mkdir = (path, callback) => {
  process.nextTick(() => callback())
}

fs.writeFile = (file, data, options, callback) => {
  if (!callback) callback = options
  process.nextTick(() => callback())
}

module.exports = fs
