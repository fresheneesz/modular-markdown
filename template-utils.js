
var trimIndentDelimiter = '--trimIndentDel1imiter--'

// This function is being used because multi-line strings using the grave accent (`) take in all the whitespace of the indents.
// Without using this function, your multi-line strings cannot be properly indented with the rest of the source code.
var trimIndent = exports.trimIndent = function(string) {
  var trimmedString = trimFirstLine(string)
  var indent = findLeastIndent(trimmedString)
  var openDelimiterFound = false
  return trimmedString.trim().split('\n').map(function(line, n) {
    var lineMatchesDelmiter = line === trimIndentDelimiter
    if(!openDelimiterFound && lineMatchesDelmiter) {
      openDelimiterFound = true
      return ''
    } else if(openDelimiterFound && lineMatchesDelmiter) {
      openDelimiterFound = false
      return ''
    }
    if(openDelimiterFound) {
      return line
    }

    if(n == 0) {
      return line
    } else {
      return line.substr(indent)
    }
  }).join('\n')
}

// This should be used to trim the indent of strings that are placed inside a template literal that is trimmed by trimIndent.
// This trims the indent and adds additional markup to ensure the indents match correctly. Its recommended this be assigned a
// short single-character function name like `t`.
// For example:
// var string = trimIndent(`
//   some content
//   more content
//   ${something ?
//     trimInternalIndent(`
//       even more content
//       `) : ''
//   }
//   `)
//
// If `something` is true, this will result in the same thing as:
// "some content\n"+
// "more content\n"+
// "even more content\n"
exports.trimIndentInner = function(string) {
  return '\n'+trimIndentDelimiter+'\n'+trimIndent(string)+'\n'+trimIndentDelimiter+'\n'
}

// Trims the first set of spaces and first newline if nothing else is on the line.
function trimFirstLine(string) {
  for(var n=0; n<string.length; n++) {
    if(string[n] !== ' ') {
      if(string[n] === '\n') {
        return string.slice(n+1)
      } else {
        return string.slice(n)
      }
    }
  }
  return ''
}

function findLeastIndent(string) {
  var leastIndent = Infinity
  var openDelimiterFound = false
  string.split('\n').forEach((line) => {
    var lineMatchesDelmiter = line === trimIndentDelimiter
    if(!openDelimiterFound && lineMatchesDelmiter) {
      openDelimiterFound = true
    } else if(openDelimiterFound && lineMatchesDelmiter) {
      openDelimiterFound = false
      return
    }
    if(openDelimiterFound) {
      return // continue
    }

    var indent = 0
    for(var n=0; n<line.length; n++) {
      if(line[n] === ' ') {
        indent++
      } else {
        if(indent < leastIndent) {
          leastIndent = indent
        }
        break
      }
    }
  })
  return leastIndent
}