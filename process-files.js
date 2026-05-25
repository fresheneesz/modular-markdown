var fs = require("fs").promises
var path = require("path")
var url = require('url')

var marked = require("marked")
var fwalk = require('kc-fwalk')

exports.processDirectory = async function(inputRoot, outputRoot, {templateExtension = ".mm.js", ignoreDirectories = []} = {}) {
    await fs.mkdir(outputRoot, {recursive: true})
    await fs.copyFile(__dirname+"/dist/darkstyle.css", outputRoot+"/darkstyle.css")
    await fs.copyFile(__dirname+"/dist/runtimeUtils.umd.js", outputRoot+"/runtimeUtils.umd.js")

    await Promise.all(getFilenames(inputRoot, ignoreDirectories).map(async function(filename) {
        await processFile(filename, templateExtension, path.resolve(inputRoot), path.resolve(outputRoot))
    }))

}

// Takes a javascript doc-template or markdown file, renders html from it, and writes it to the release directory.
var processFile = exports.processFile = async function (filename, templateExtension, inputRoot, outputRoot) {
    var basename = path.basename(filename)
    var dirname = path.dirname(filename)
    var sourceFilePath = filename
    var relativeDirectory = normalizePathSep(dirname).slice(normalizePathSep(inputRoot).length) // Relative to the inputRoot.

    var isTemplate = hasExtension(filename, templateExtension)
    var isMarkdown = hasExtension(filename, ".md")
    if(isTemplate || isMarkdown) {
        if(isTemplate) {
            var suffixLength = templateExtension.length
        } else if(isMarkdown) {
            var suffixLength = 3
        }
        var releaseFileName = basename.slice(0, -suffixLength)+".html"
        var baseDirectoryPath = strmult("../", relativeDirectory.split('/').length-1)
    } else {
        var releaseFileName = basename
    }

    var releaseFilePath = outputRoot+relativeDirectory+"/"+releaseFileName
    await fs.mkdir(path.dirname(releaseFilePath), {recursive:true})
    if(isTemplate || isMarkdown) {
        if(isTemplate) {
            var resultingHtml = require(normalizePathSep(sourceFilePath)).generate(baseDirectoryPath)
        } else if(isMarkdown) {
            var resultingHtml = marked((await fs.readFile(sourceFilePath)).toString())
        }

        await fs.writeFile(releaseFilePath, resultingHtml)
    } else {
        await fs.copyFile(sourceFilePath, releaseFilePath)
    }
}

function hasExtension(filename, extension) {
    return filename.slice(-extension.length) === extension
}

// Gets the filenames to copy.
function getFilenames(srcDirectory, ignoreDirectories) {
  var filenames = []//'README.md']
  fwalk(srcDirectory, true).forEach(function(filename) {
    // Filter out non-project directories
    for(var n=0; n<ignoreDirectories.length; n++) {
      if(filename.indexOf("./"+ignoreDirectories[n]) === 0) return // Ignore file in that directory.
    }

      filenames.push(filename)
  })
  return filenames
}

// Concatenate a string together multiple times.
function strmult(str, count) {
    var result = []
    for(var n=0; n<count; n++) {
        result.push(str)
    }
    return result.join("")
}

function normalizePathSep(filepath) {
    return path.resolve(filepath).split(path.sep).join("/")
}