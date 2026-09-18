const path = require('path')

const uploadsRoot = path.resolve(
  process.env.UPLOADS_ROOT || path.join(__dirname, '../../../storage/uploads')
)

module.exports = {
  uploadsRoot
}
