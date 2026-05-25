
// This function is being used because multi-line strings using the grave accent (`) take in all the whitespace of the indents.
// Without using this function, your multi-line strings cannot be properly indented with the rest of the source code.
var trimIndent = exports.trimIndent = function(string) {
  var trimmedString = fixFirstlineIndent(string)
  var indent = findLeastIndent(trimmedString)
  var openDelimiterFound = false
  return trimmedString.trim().split('\n').map(function(line, n) {
    if(n == 0) {
      return line
    } else {
      return line.substr(indent)
    }
  }).join('\n')
}

// This makes sure that the first line's indent is consistent with the rest of the string.
function fixFirstlineIndent(string) {
  var leastIndent = findMainIndent(string)
  var firstNewline = string.indexOf('\n')
  var firstLine = string.slice(0,firstNewline)

  var firstNonSpaceCharIndex = 0
  for(var n=0; firstLine[n] === " " && n<firstLine.length; n++) {
    firstNonSpaceCharIndex++
  }

  return strmult(" ", leastIndent)+firstLine.slice(firstNonSpaceCharIndex)+string.slice(firstNewline)
}

// Finds the indent excluding the first line.
exports.findMainIndent = findMainIndent
function findMainIndent(string) {
  var firstNewline = string.indexOf('\n')
  return findLeastIndent(string.slice(firstNewline))
}

exports.trimFinalEmptyLine = function(string) {
  if(string[string.length-1] === '\n') {
    return string.slice(0, -1)
  } else {
    return string
  }
}

exports.strmult = strmult
function strmult(string, multiplier) {
    var result = []
    for(var n=0; n<multiplier; n++) {
        result.push(string)
    }
    return result.join('')
}

// Trims the first set of spaces and first newline if nothing else is on the line.
function trimFirstLine(string) {
  for(var n=0; n<string.length; n++) {
    if(string[n] !== ' ') {
      return string.slice(n)
    }
  }
  return ''
}

exports.findLeastIndent = findLeastIndent
function findLeastIndent(string) {
  var leastIndent = Infinity
  var openDelimiterFound = false
  string.split('\n').forEach((line) => {
    if(line.length === 0) {
      return // Skip empty lines
    } else {
      var indent = 0
      for(var n=0; n<line.length; n++) {
        if(line[n] === ' ') {
          indent++
        } else if(line[n] === '\n') {
          return // Skip white-space only lines
        } else {
          if(indent < leastIndent) {
            leastIndent = indent
          }
          break
        }
      }
    }
  })

  if(leastIndent === Infinity) {
    return 0
  } else {
    return leastIndent
  }
}