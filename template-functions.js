var marked = require("marked")

var {createPage} = require("./markdown-merge")
var {trimIndent} = require("./template-utils")

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
            `<script>document.getElementById(${parentTemplateFunction.inputListId}).style.display = 'none' // Hide the parent input list.
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


var globalId = 0
function getId() {
  return globalId++
}

function identity(v) {return v}



// Related project:
// https://github.com/gitpitch/gitpitch/wiki/Modular-Markdown/21996da3cefc336be13342a2dcedc7bf4631fe2f
// https://www.invisionapp.com/inside-design/modular-architecture-design-documentation/
// https://opensource.com/article/17/9/modular-documentation