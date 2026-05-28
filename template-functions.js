var url = require('url')
var UglifyJS = require("uglify-js")

// Hide warning caused by using require on marked
process.removeAllListeners('warning').on('warning', err => {
    if (err.name !== 'ExperimentalWarning' && !err.message.includes('marked.esm.js using require()')) {
        console.warn(err)
    }
})
var {marked} = require("marked")

var {createPage} = require("./markdown-merge")
var {trimIndent, trimFinalEmptyLine, findMainIndent, strmult} = require("./template-utils")

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
            if (inputDescriptor._type === 'override' && !(inputName in parentTemplateFunction.registeredInputs)) {
              throw new Error(`Invalid use of override for input: '${inputName}'. No input with that name in the parent template.`)
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
          var override = inputDescriptor._type === 'override'
          var notOverriddenInChild = !(inputName in originalInputMap) // If the input is not in the child input list but is in the parent.
          if (override || notOverriddenInChild) {
            const parentInputId = parentTemplateFunction.registeredInputs[inputName]
            const mapInputDescriptor = override?
              inputDescriptor.mapInputDescriptor :
              {mapFunction: JSON.stringify(identity.toString()), inputNames:[inputName]}
            const subInputDescriptor = override? inputDescriptor.subInputDescriptor : inputDescriptor
            var inputContent = processInputDescriptor(
              templateFunction.inputListId, id, {_type: 'override', options: {
                subInputDescriptor, parentInputId, mapInputDescriptor
              }}
            )
          // A non-inherited input
          } else {
            var inputContent = processInputDescriptor(templateFunction.inputListId, id, inputDescriptor)
          }

          var title = ''
          if(inputDescriptor.tooltip) {
            title = 'title="'+inputDescriptor.tooltip+'"'
          }

          if (desc) {
            var indent = findMainIndent(desc)
            var markedDesc = marked(trimIndent(desc))
            var indentedMarkedDesc = markedDesc.split('\n').map(line => strmult(' ', indent)+line).join('')
            var markedDescription = trimFinalEmptyLine(indentedMarkedDesc) //trimIndentForInner(marked(desc))//trimIndent(marked(desc))
          }

          //this.inputsOverridesCreated = true
          return `<div class='input' ${title}>`+
            "<span class='label'>"+label+":</span> "+ inputContent +
            (desc? "<div class='desc'>"+markedDescription+"</div>": '')
          +"</div>"

        // Note that this join can't have line breaks in it because it will mess up the indent resulting in whitespace not getting trimmed.
        }).join('')

        var hideScript = ''
        if(parentTemplateFunction) {
          hideScript =
            "<script>;(function() {"+
              // Hide the parent input list.
              `var element = document.getElementById(${parentTemplateFunction.inputListId});`+
              "if(element) {" +
                "element.style.display = 'none';"+
              "} else {"+
                // Do this asynchronously so the rest of the page has a chance to load first.
                "setTimeout(() => {" +
                  `var element = document.getElementById(${parentTemplateFunction.inputListId});`+
                  "element.style.display = 'none';" +
                  "}, 0);"+
              "}" +
            "})()"+
            "</script>"
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
            return "<script>"+
              "inputMapping("+templateFunction.inputListId+", "+JSON.stringify(inputName)+", "+valueId+", "+minify(mappingFn.toString())+")" +
            "</script>"+
            // This is put after the related script because of this bug: https://github.com/markedjs/marked/issues/3981
            "<span id='"+valueId+"'></span>"
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

  function generateHtmlForTemplateFunction(templateFunction, baseDirectoryPath) {
    // A map of input ids to input maps. The input id identifies the 'inputs' html list elmeent
    // (differentiating an ancestor list from descendant lists).
    // Each input map maps an input name to a unique ID of the input html element
    const inputRegistry = {}
    // Generate the content before creating the runtime inputRegistryVariable, so inputRegistry is populated first.
    const generatedContent = templateFunction._generate(inputRegistry)

    return generateHtml(
      createGlobalItems(inputRegistry) +
      marked(generatedContent) +
      createRunInitializersCode(),
      baseDirectoryPath)
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
    innerTemplateFunction.generate = function(baseDirectoryPath) {
      return generateHtmlForTemplateFunction(innerTemplateFunction, baseDirectoryPath)
    }

    return innerTemplateFunction
  }

  templateFunction.registeredInputs = {}
  templateFunction.inputListId = getId()

  templateFunction._generate = function(inputRegistry, argsToPass) {
    inputRegistry[templateFunction.inputListId] = {} // Why is this being set here? It seems to be already set on lines 35 or 38.
    var templateOutput = callback.apply(createThisMethods(inputRegistry, templateFunction), argsToPass)
    return createPage(trimIndent(templateOutput || ""))
  }

  // External generate, initializes the whole page.
  templateFunction.generate = function(baseDirectoryPath) {
    return generateHtmlForTemplateFunction(templateFunction, baseDirectoryPath)
  }

  return templateFunction
}

// Takes in markdown text and generates an html file from it.
function generateHtml(body, baseDirectoryPath) {
  marked.use({renderer: {link: function(hrefInfo, title, text) {
    var href = hrefInfo.href
    var parsedUrl = url.parse(href)
    if(!parsedUrl.protocol && parsedUrl.path && parsedUrl.path.slice(-3) === ".md") {
      // Replace local markdown links with the path to the html version
      href = parsedUrl.path.slice(0, -3)+".html"+(parsedUrl.hash?parsedUrl.hash:'')
    }
    return "<a href='"+href+"'>"+text+"</a>"
  }}})

  return "<!-- This file was generated by generate-release.js -->\n" +
         "<!DOCTYPE html>\n"+
         "<head>\n"+
          "<meta charset='utf-8'>"+
          "<link rel='stylesheet' type='text/css' href='"+baseDirectoryPath+"darkstyle.css'></link>"+
         "</head>\n" +
         "<script src='"+baseDirectoryPath+"runtimeUtils.umd.js'></script>" +
         "<body>" +
           body+
         "</body>"
}

// Produces a unique html element that is updated according to the input type.
// id - A unique integer
// type - One of the input element names (eg "textbox").
function processInputDescriptor(inputListId, id, {_type, ...options}) {
  if(options._inputListId !== undefined) {
    throw new Error("Options already contains an inputListId value, which is needed internally.")
  }

  options._inputListId = inputListId

  return "<div class='inputElement' id='"+id+"'></div><script>"+
    _type+"("+JSON.stringify({id, ...options})+")"
  +"</script>"
}


// For each of these names, this creates an input descriptor for the input type.
;['list', 'map', 'hidden'].forEach(name => {
  exports[name] = function(options) {
    return {_type: name, ...options}
  }
})

exports.combobox = function(options={}) {
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

function minify(string) {
  var prefix = "var f="
  var result = UglifyJS.minify(prefix + string)//, {compress:{dead_code: false, side_effects:false}, output: {semicolons: true}})
  if(result.error) {
    throw new Error(`${result.error.name} minifying ${JSON.stringify(string)}: ${result.error.toString()}`)
  }
  // Remove the prefix and final semi colon if it added it
  var code = result.code.slice(prefix.length)
  return code.endsWith(";") ? code.slice(0, -1) : code
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