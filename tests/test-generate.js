var fs = require("fs").promises
var path = require("path")
var url = require('url')

var {processDirectory} = require("../modular-markdown")

;(async function() {
try {
    await processDirectory(__dirname+'/test-templates', __dirname+'/generated-tests')
} catch(e) {
    console.error(e)
}
})()
