const path = require('path')
const walk = require('walk-sync')
const { nodeVersions } = require('../package.json')
const nodeMajors = Object.keys(nodeVersions)
const contentDir = path.join(__dirname, 'content')
const pages = walk(contentDir, {directories: false})
  .filter(filename => filename.endsWith('.md'))
  .map(filename => {
    const fullPath = path.join(contentDir, filename)
    const nodeVersion = filename.split(path.sep)[0]
    const locale = filename.split(path.sep)[1]
    const filePath = filename.split(path.sep).slice(2).join(path.sep)
    return {locale, nodeVersion, filePath, fullPath}
  })

module.exports = {
  pages,
  getDocset
}

async function getDocset(nodeMajor, locale) {
  // set defaults
  nodeMajor = nodeMajor || nodeMajors[0] // latest
  locale = locale || 'en-US'

  return pages
    .filter(page => page.nodeVersion === nodeMajor)
    .filter(page => page.locale === locale)
}