const path = require('path');

module.exports = {
  getPersonasPath: () => path.join(__dirname, 'personas'),
  getSysPath: () => path.join(__dirname, 'sys'),
  getConfigsPath: () => path.join(__dirname, 'configs')
};
