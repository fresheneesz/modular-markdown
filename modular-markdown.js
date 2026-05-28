var templateFunctions = require("./template-functions")
var processFiles = require("./process-files")

module.exports = {...templateFunctions, ...processFiles}


// Related project:
// https://github.com/gitpitch/gitpitch/wiki/Modular-Markdown/21996da3cefc336be13342a2dcedc7bf4631fe2f
// https://www.invisionapp.com/inside-design/modular-architecture-design-documentation/
// https://opensource.com/article/17/9/modular-documentation