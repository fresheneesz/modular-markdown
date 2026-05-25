var {processDirectory} = require("../modular-markdown")

;(async function() {
try {
    await processDirectory(__dirname+'/test-templates', __dirname+'/generated-tests', {ignorePaths: [
        'ignoreTestA', 'maybeIgnoreThis.txt'
    ]})
} catch(e) {
    console.error(e)
}
})()
