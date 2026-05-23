var marked = require("marked")

var {trimIndent} = require("./template-utils")


// Section object:
// {level: _,
//  header: _,
//  operation: _,
//  lines: _,
//  subsections: _,
//  newName: _,  // This marks the name the header should have after creation
//  renameTo: _, // This marks the name this header should be renamed to (in further processing)
// }



const template = exports.template = function(callback) {
  var createThisMethods = function(inputRegistry, templateFunction, parentTemplateFunction) {
    return {
      inputs: function(originalInputMap) {
        if (parentTemplateFunction) {
          // Check for inputs that haven't been properly overridden.
          for (const inputName in originalInputMap) {
            var inputDescriptor = originalInputMap[inputName].input
            if (inputDescriptor._type !== 'override' && inputName in parentTemplateFunction.registeredInputs) {
              throw new Error(`Name has already been used for input: '${inputName}'. If you want to override an input from a parent template, use 'override'.`)
            }
          }

          var inputMap = {...parentTemplateFunction.inputMap, ...originalInputMap}
        } else {
          var inputMap = originalInputMap
        }

        templateFunction.inputMap = inputMap
        //inputRegistry[templateFunction.inputListId] = Object.assign({}, inputRegistry[parentTemplateFunction?.inputListId] || {})
        const renderedInputList = Object.keys(inputMap).map(function(inputName) {
          const id = getId()
          inputRegistry[templateFunction.inputListId][inputName] = id

          const {input: inputDescriptor, link, desc} = inputMap[inputName]
          templateFunction.registeredInputs[inputName] = id

          var label = inputName
          if (link !== undefined) {
            label = "<a href='"+link+"'>"+label+'</a>'
            delete inputDescriptor.link // Remove it from the arguments.
          }

          // Process the input descriptor.
          if (inputDescriptor._type === 'override') {
            const parentInputId = parentTemplateFunction.registeredInputs[inputName]
            const mapInputDescriptor = inputDescriptor.mapInputDescriptor
            var inputContent = processInputDescriptor(
              templateFunction.inputListId, id, {_type: 'override', options: {
                subInputDescriptor: inputDescriptor.subInputDescriptor,
                parentInputId, mapInputDescriptor
              }}
            )
          } else if (!(inputName in originalInputMap)) {
            const parentInputId = parentTemplateFunction.registeredInputs[inputName]
            const mapInputDescriptor = {mapFunction: JSON.stringify(identity.toString()), inputNames:[inputName]}
            var inputContent = processInputDescriptor(
              templateFunction.inputListId, id, {_type: 'override', options: {
                subInputDescriptor: inputDescriptor,
                parentInputId, mapInputDescriptor
              }}
            )
          } else {
            var inputContent = processInputDescriptor(templateFunction.inputListId, id, inputDescriptor)
          }

          var title = ''
          if(inputDescriptor.tooltip) {
            title = 'title="'+inputDescriptor.tooltip+'"'
          }

          if (desc) {
            var markedDescription = trimIndent(marked(desc))
          }

          //this.inputsOverridesCreated = true
          return "<div class='input' ${title}>"+
            "<span class='label'>"+label+"</span>: "+ (desc? "<span class='desc'>"+markedDescription+"</span><div class='inputContent'>"+inputContent+'</div>': inputContent)
          +"</div>"

        // Note that this join can't have line breaks in it because it will mess up the indent resulting in whitespace not getting trimmed.
        }).join('')

        var hideScript = ''
        if(parentTemplateFunction) {
          hideScript =
            `<script>getElementById(${parentTemplateFunction.inputListId}).style.display = 'none' // Hide the parent input list.
            </script>`
        }

        return `<div id='${templateFunction.inputListId}'>${renderedInputList}</div>` + hideScript
      },
      input: function(inputName) {
        const valueId = getId()
        // if (inputId === undefined) {
        //   throw new Error(`Input method called on name that doesn't exist: '${inputName}'`)
        // }
        return {
          value: "<span id='"+valueId+"'></span>"+
            "<script>"+"input("+templateFunction.inputListId+", "+JSON.stringify(inputName)+", "+valueId+")</script>",

          // mappingFn(value) - A function that maps the received value to some text.
          map: function(mappingFn) {
            return "<span id='"+valueId+"'></span>"+
            "<script>"+
              "inputMapping("+templateFunction.inputListId+", "+JSON.stringify(inputName)+", "+valueId+", "+mappingFn.toString()+")" +
            "</script>"
          }
        }
      }
    }
  }

  function createGlobalItems(inputRegistry) {
    return `<script>
      var inputRegistry = ${JSON.stringify(inputRegistry)}
      createResetPageButton()
    </script>\n`
  }
  function createRunInitializersCode() {
    return `<script>
      runInitializers()
    </script>`
  }

  const templateFunction = function(...args) {
    const innerCallback = args[args.length-1] // The function that defines the child page.
    const argsToPass = args.slice(0,-1)
    const innerTemplateFunction = template(innerCallback)
    innerTemplateFunction.registeredInputs = {}
    innerTemplateFunction.inputListId = getId()

    // Override generate to join the templates together.
    innerTemplateFunction._generate = function(inputRegistry) {
      var generatedParentPage = templateFunction._generate(inputRegistry, argsToPass)
      // Shallow copy the parent template's input list. This must be done after generating the parent page.
      inputRegistry[innerTemplateFunction.inputListId] = Object.assign({}, inputRegistry[templateFunction?.inputListId] || {})
      return createPage(
        generatedParentPage,
        trimIndent(innerCallback.apply(createThisMethods(inputRegistry, innerTemplateFunction, templateFunction)) || "")
      )
    }

    // External generate, initializes the whole page.
    innerTemplateFunction.generate = function() {
      // A map of input ids to input maps. The input id identifies the 'inputs' html list elmeent
      // (differentiating an ancestor list from descendant lists).
      // Each input map maps an input name to a unique ID of the input html element
      const inputRegistry = {}
      // Generate the content before creating the runtime inputRegistryVariable, so inputRegistry is populated first.
      const generatedContent = innerTemplateFunction._generate(inputRegistry)

      // if(!innerCallback.inputsOverridesCreated) {
      //
      // }

      return createGlobalItems(inputRegistry) +
        generatedContent +
        createRunInitializersCode()
    }

    return innerTemplateFunction
  }

  templateFunction.registeredInputs = {}
  templateFunction.inputListId = getId()

  templateFunction._generate = function(inputRegistry, argsToPass) {
    inputRegistry[templateFunction.inputListId] = {} // Why is this being set here? It seems to be already set on lines 35 or 38.
    return createPage(trimIndent(callback.apply(createThisMethods(inputRegistry, templateFunction), argsToPass) || ""))
  }

  // External generate, initializes the whole page.
  templateFunction.generate = function() {
    const inputRegistry = {}
    // Generate the content before creating the runtime inputRegistryVariable, so inputRegistry is populated first.
    const generatedContent = templateFunction._generate(inputRegistry)
    return createGlobalItems(inputRegistry) +
      generatedContent +
      createRunInitializersCode()
  }

  return templateFunction
}

// Produces a unique html element that is updated according to the input type.
// id - A unique integer
// type - One of the input element names (eg "textbox").
// overrideInfo - looks like this is unused?
function processInputDescriptor(inputListId, id, {_type, ...options}, overrideInfo) {
  if (overrideInfo) {
    options.parentInputId = overrideInfo.parentInputId
    options.mapInputDescriptor = overrideInfo.mapInputDescriptor
  }

  if(options._inputListId !== undefined) {
    throw new Error("Options already contains an inputListId value, which is needed internally.")
  }

  options._inputListId = inputListId

  return "<span id='"+id+"'></span><script>"+
    _type+"("+JSON.stringify({id, ...options})+")"
  +"</script>"
}

// // For each of these names, this creates a function that creates an element of that type on the page.
// ;['text', 'textbox', 'combobox', 'list'].forEach(name => {
//   exports[name] = function() {
//     const parameters = []
//     for (var n=0; n<arguments.length; n++) {
//       parameters.push(JSON.stringify(arguments[n]))
//     }
//     const id = getId()
//     return "<span id='"+id+"'></span><script>"+name+"("+id+','+parameters.join(',')+")</script>"
//   }
// })


// For each of these names, this creates an input descriptor for the input type.
;['textbox', 'list', 'map', 'hidden'].forEach(name => {
  exports[name] = function(options) {
    return {_type: name, ...options}
  }
})

exports.combobox = function(options) {
  options.listId = getId()
  return {_type: 'combobox', ...options}
}

// mapInputDescriptor - Function can't use double quotes for some stupid reason (probably because of the markdown parser).
exports.override = function(subInputDescriptor, mapInputDescriptor) {
  return {_type: 'override', subInputDescriptor, mapInputDescriptor}
}


exports.mapInputs = function(...args) {
  const inputNames = args.slice(0, -1)
  let mapFunction = args[args.length-1]
  if (typeof mapFunction !== 'function') {
    const staticMappedValue = mapFunction
    mapFunction = function() {
      return staticMappedValue
    }
  }

  return {mapFunction: JSON.stringify(mapFunction.toString()), inputNames}
}

// Takes two markdown-like inputs (content and childPage) and merge the content of their sections together.
// # headings can also be post-pended with 'b', 'a', or 'r' (eg ##b or ###r)
  // b - Places content before inherited content.
  // a - Places content after inherited content.
  // r - Replaces inherited content entirely.
  // n - Renames the header to something else. The new header name should appear as a header on the line directly below
    //   and can also contain a post-pended operator. The name will map properly (sections within the previous heading
    //   will properly be matched to sections under the new heading).
// '' is replaced with `
const createPage = exports.createPage = function(/*[parentContent],*/ content) {
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

function strmult(string, multiplier) {
    var result = []
    for(var n=0; n<multiplier; n++) {
        result.push(string)
    }
    return result.join('')
}

var globalId = 0
function getId() {
  return globalId++
}

function identity(v) {return v}



// Related project:
// https://github.com/gitpitch/gitpitch/wiki/Modular-Markdown/21996da3cefc336be13342a2dcedc7bf4631fe2f
// https://www.invisionapp.com/inside-design/modular-architecture-design-documentation/
// https://opensource.com/article/17/9/modular-documentation
// https://opensource.com/article/17/9/modular-documentation