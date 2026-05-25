// This file contains the code needed to merge markdown files together.

var {strmult} = require("./template-utils")

// Takes two markdown-like inputs (content and childPage) and merge the content of their sections together.
// # headings can also be post-pended with 'b', 'a', or 'r' (eg ##b or ###r)
  // b - Places content before inherited content.
  // a - Places content after inherited content.
  // r - Replaces inherited content entirely.
  // n - Renames the header to something else. The new header name should appear as a header on the line directly below
    //   and can also contain a post-pended operator. The name will map properly (sections within the previous heading
    //   will properly be matched to sections under the new heading).
// '' is replaced with `
exports.createPage = function(/*[parentContent],*/ content) {
  if(arguments.length === 2) {
    var childContent = arguments[1]
  }
  var parentSections = parseSections(content)

  if(childContent) {
    var childSections = parseSections(childContent)
    insertSectionMaps(parentSections)
    mergeSections(parentSections[0], childSections[0])
  }

  var result = []
  loopThroughSections(parentSections, (section) => {
    if(section.level !== 0) {
      var operation = section.operation? section.operation : ''
      var renameHeader
      if(section.renameTo) {
        renameHeader = strmult('#', section.level)+operation+' '+section.renameTo
        operation = 'n'
      }

      result.push(strmult('#', section.level)+operation+' '+(section.newName || section.header))
      if(renameHeader) {
        result.push(renameHeader)
      }
    }
    result = result.concat(section.lines)
  })

  return result.join('\n')
}

// // Takes two maps and creates a bulleted list from the names and values.
// // Each item will look like "Name: Value".
// // Any item in b that is also in a will be ommitted.
// const mergedList = exports.mergedMap = function(a, b) {
//   if(!a) a = {}
//
//   var results = []
//   for(var name in a) {
//       results.push("* "+name+": "+a[name])
//   }
//   for(var name in b) {
//       if(!(name in a)) {
//         results.push("* "+name+": "+b[name])
//       }
//   }
//   return results.join('\n')
// }

// Merges b into a where each are a set of sections.
function mergeSections(a, b, operation) {
  if(operation === 'r') {
    a.lines = b.lines
  } else if(operation === 'b') {
    a.lines = b.lines.concat(a.lines)
  } else {// if(operation === 'a') {
    a.lines = a.lines.concat(b.lines)
  }
  if(b.renameTo) {
    a.newName = b.renameTo
  }

  for(var n=0; n<b.subsections.length; n++) {
    var subsection = b.subsections[n]
    var matchingSubsection = a.map[makeSectionKey(subsection, false)]
    if(matchingSubsection) {
      mergeSections(matchingSubsection, subsection, subsection.operation)
    } else {
      if(subsection.operation === 'b') {
        a.subsections.unshift(subsection)
      } else {// if(subsection.operation === 'a') {
        a.subsections.push(subsection)
      }
    }
  }
}

// Inserts a map in each section that maps a section key to a subsection.
function insertSectionMaps(sections) {
  // Insert header mappings into the parentSections
  loopThroughSections(sections, (section) => {
    section.map = {}
    section.subsections.forEach((subsection) => {
      section.map[makeSectionKey(subsection, true)] = subsection
    })
  })
}

function makeSectionKey(section, isParent) {
  // The underscore is in there to ensure there is no mapping ambiguity (eg without it,
  // "10Some Header" might mean "########## Some Header" or might mean "# 0Some Header")
  return section.level + '_' + (isParent && section.renameTo ? section.renameTo: section.header)
}

function removeRepeatedEmptyLines(lines) {
  var lastLineWasEmpty = false
  var result = []
  for(var n=0; n<lines.length; n++) {
    var line = lines[n]
    if(line === '' && lastLineWasEmpty) {
      continue // Skip this line
    }
    lastLineWasEmpty = line === ''

    result.push(line)
  }
  return result
}


// Returns a list of section objects, each with the properties:
// {level: _,
//  lines: _,
//  subsections: _,
//  header: _,
//  operation: _,
//  newName: _,  // This marks the name the header should have after creation
//  renameTo: _, // This marks the name this header should be renamed to (in further processing)
// }
function parseSections(content) {
  var lines = content.split('\n')
  lines = removeRepeatedEmptyLines(lines)

  var sections = [], curSection = {level: 0, lines: [], subsections: []}
  sections.push(curSection)
  for(var n=0; n<lines.length; n++) {
    var line = lines[n]
    if(line[0] === '#') {
      curSection = createNewSection(sections, line)
    } else {
      curSection.lines.push(line)
    }
  }

  return sections
}

function createNewSection(sections, line) {
  var headerInfo = getHeaderInfo(line)

  // Handle section renaming if applicable
  var lastSection = sections[sections.length-1]
  while(lastSection.subsections.length > 0) {
    lastSection = lastSection.subsections[lastSection.subsections.length - 1]
  }
  if(lastSection.operation === 'n') {
    if(headerInfo.level !== lastSection.level) {
      throw new Error("Section '"+lastSection.header+"' does not match the level of its rename: '"+line+"'")
    } else if(lastSection.lines.length > 0 || lastSection.subsections.length > 0) {
      throw new Error("Renamed section '"+lastSection.header+"' must be proceeded immediately by a matching header with the new name.")
    }
    lastSection.renameTo = headerInfo.header
    lastSection.operation = headerInfo.operation
    return lastSection
  }

  var lastSectionLevel, thisSectionLevel = sections[sections.length-1]
  while(true) {
    lastSectionLevel = thisSectionLevel
    thisSectionLevel = lastSectionLevel.subsections[lastSectionLevel.subsections.length - 1]
    if(!thisSectionLevel || thisSectionLevel.level >= headerInfo.level) {
      lastSectionLevel.subsections.push(headerInfo)
      return headerInfo
    }
  }
}

// Parses a line for its header prefix (eg '##' or "###b') and returns an object like:
// {level: _, operation: _}
function getHeaderInfo(line) {
  var level = 0, operation
  for(var n=0; n<line.length; n++) {
    if(line[n] === '#') {
      level++
    } else {
      var splitAt = n
      if(line[n] in {b:1, a:1, r:1, n:1}) {
        operation = line[n]
        splitAt += 1
      }
      return {level: level, header: line.slice(splitAt).trim(), operation: operation, lines: [], subsections: []}
    }
  }
}

function loopThroughSections(sections, callback) {
  for(var n=0; n<sections.length; n++) {
    var section = sections[n]
    callback(section)
    if(section.subsections.length > 0) {
      loopThroughSections(section.subsections, callback)
    }
  }
}
