// Builds the runtimeUtils module needed by generated html files.

var fs = require("fs").promise
var path = require("path")
var url = require('url')

const webpack = require("webpack")
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

;(async function() {
try {
    var entrypointFilepath = path.join(__dirname,'runtimeUtils.js')
    var outputFilepath = path.join(__dirname,'dist/runtimeUtils.umd.js')
    await build(entrypointFilepath, outputFilepath)
} catch(e) {
    console.error(e)
}
})()

function build(entryFile, outFile, handleWarnings) {
  return new Promise((resolve, reject) => {
    webpack(
      {
        mode: "development",
        target: "web", // use "web" for browser bundles
        entry: path.resolve(entryFile),
        output: {
          path: path.dirname(path.resolve(outFile)),
          filename: path.basename(outFile),
          libraryTarget: "umd", // makes bundled module require-able
        },
        optimization: {
          minimize: true,
        },
        plugins: [
          new NodePolyfillPlugin()
        ]
      },
      (err, stats) => {
        if (err) return reject(err);

        const info = stats.toJson();
        if (stats.hasWarnings()) {
          if (options.handleWarning) {
            options.handleWarnings(info.warnings)
          } else {
            console.log(info.warnings)
          }
        }
        if (stats.hasErrors()) {
          return reject(new Error(info.errors.map(e => e.message).join("\n")));
        }

        resolve(stats);
      }
    );
  });
}