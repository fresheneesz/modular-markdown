// This file contains utilities used at runtime by doc templates.

var proto = require('proto')
var EmitterB = require('emitter-b')
var shared = require('./shared')

// Pattern:
  // Param objects initialize themselves based on an arg and then re-initialize when an arg emits a change event.
  // Param objects can define an override to the default Arg display.
  // Need a way to display uneditable list items

resetPageButton()

var moduleExports = (function() {

  const listeners = [], defaultInitializers = []
  var defaultsInitialized = false

  function runInitializers() {
    // Register listeners first, then default initializers (so the listeners also get the defaults).
    for (const initializer of listeners.concat(defaultInitializers)) {
      initializer()
    }
    defaultsInitialized = true
  }

  var state = {}
  var urlState = getHashArgument('state')
  if(urlState) {
    try {
      state = JSON.parse(urlState)
      history.replaceState(state, '', location.href)
    } catch(e) {
      alert("Could not restore state: "+e)
    }
  }

  // changeHistoryState ensures that only one history state change happens per continuation to avoid spamming the history state.
  var historyStateRequested = false
  function changeHistoryState() {
    if(!historyStateRequested) {
      const origin = location.origin !== "null" ? location.origin : location.protocol+"//"
      var newUrl = origin+location.pathname+'#state='+JSON.stringify(state)
      setTimeout(() => {
        history.replaceState(state, '', newUrl)
        historyStateRequested = false
      })
      historyStateRequested = true
    }
  }

  // This class represents an argument that can be set by the user. Arguments are reinitialized from page history state
  // when the user returns to the page.
  // args - The parameter passed to the constructor can either be a json object or a js object that contains arguments for the Argument ; )
    // defaultValue - This can be optionally set to initialize the value of the Argument. Will be ignored if history state initializes it.
  // Required methods:
    // value() - Retrieves a js object representation of the value
    // setValue() - Sets the value programmatically. This is needed to restore from page history state.
  // Required events:
    // change - Should be emitted when the argument is changed.
  var Input = proto(EmitterB, function(superclass) {
    this.init = function(options) {
      superclass.init.apply(this, arguments)
      this.options = this.getArgs(options)

      // For subnodes of other nodes, the parent node should set the 'node' option before creating the subnode.
      this.node = this.options.node || getElementById(options.id)
      this.node.inputObject = this

      // If it doesn't have an id then its a subobject that doesn't need to record history state changes directly.
      if (options.id) {
        this.on('change', () => {
          state[options.id] = this.value()
          changeHistoryState()
        })
      }

      const addDefaultInitializer = (value) => {
        const initializeDefaults = () => {
          if (value !== undefined) {
            this.setValue(value)
          }
          this.emit('change')
        }

        if (defaultsInitialized) {
          // If the initializers have already been ran, this will just initialize
          // immediately after the current thread finishes.
          setTimeout(initializeDefaults, 0)
        } else {
          defaultInitializers.push(initializeDefaults)
        }
      }

      // Initialize asynchronously to make sure it happens after any inheriting class constructors finish.
      if(history.state && options.id !== undefined && history.state[options.id] !== undefined) {
        addDefaultInitializer(history.state[options.id])
      } else {
        addDefaultInitializer(options.defaultValue)
      }
    }

    this.getArgs = function(args) {
      if(typeof args === 'string') {
        console.log("Parsing args") // Todo: remove this branch if its not needed.
        return JSON.parse(args)
      } else {
        return args
      }
    }

    // Required method subclasses should extend.
    this.value = function() {

    }

    // Required method subclasses should extend.
    this.setValue = function(value) {
      // Do this asynchronously so that the change event is triggered *after* the value is set.
      setTimeout(() => {
        this.emit('change')
      })
    }
  })

  // args:
    // defaultValue
  var textbox = proto(Input, function(superclass) {
    this.init = function() {
      superclass.init.apply(this, arguments)

      this.input = document.createElement('input')
      this.input.addEventListener("input", () => {
        this.emit('change')
      })
      this.node.appendChild(this.input)
    }

    this.value = function() {
      superclass.value.apply(this, arguments)
      return this.input.value
    }

    this.setValue = function(value) {
      superclass.setValue.apply(this, arguments)
      this.input.value = value
    }
  })

  // args:
    // id - A unique html id.
    // values - An array of values to display for the combobox.
  // Note that this combobox sucks because it uses datalist which can't be opened on click.
  var combobox = proto(textbox, function(superclass) {
    this.init = function() {
      superclass.init.apply(this, arguments)

      const listId = 'comoboboxList'+getId() // this.options.listId
      const options = this.options

      this.input.setAttribute("list", listId)
      this.input.setAttribute("autocomplete", "off")

      if (options.values) {
        this.optionsList = document.createElement('div')
        this.optionsList.classList.add('optionsList')
        options.values.forEach(value => {
          var option = document.createElement('div')
          option.append(value)

          var selectOption = () => {
            this.input.value = value
            this.emit('change')
            this.optionsList.style.display = "none"
          }
          option.addEventListener("click", selectOption)
          option.addEventListener("pointerup", selectOption)

          this.optionsList.appendChild(option)
        })

        this.optionsList.style.display = "none"
        this.input.after(this.optionsList)

        this.input.addEventListener("focus", () => {
          this.optionsList.style.display = ""
        })

        addCrossDeviceClickListener(document, event => {
          if(!eventIsOverElement(event, this.optionsList) && !eventIsOverElement(event, this.input)) {
            this.optionsList.style.display = "none"
          }
        })
      }
    }
  })

  function addCrossDeviceClickListener(element, handler) {
    var pointerId;

    function downHandler(event) {
      pointerId = event.pointerId
    }
    function upHandler(event) {
      if(pointerId === event.pointerId) {
        handler(event)
      }
    }

    element.addEventListener("click", handler)
    element.addEventListener("pointerup", upHandler)
    element.addEventListener("pointerdown", downHandler)
  }

  function eventIsOverElement(event, element) {
    const rect = element.getBoundingClientRect()
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    )
  }

  // A list of items of a particular type.
  // args:
    // type - the name of an argumentType (see argumentTypes list).
    // subargs - the args for the subtype
    // editable - If true, there's an "Add" button that allows the user to edit the list. Otherwise
    // addButtonName
  var list = proto(Input, function(superclass) {
    this.init = function() {
      superclass.init.apply(this, arguments)

      this.listNode = document.createElement('div')
      var addButton = this.addButton = createButton(this.options.addButtonName || 'Add Item')

      addButton.addEventListener('click', () => {
        this.addItem()
      })

      this.node.append(this.listNode, addButton)
    }

    this.addItem = function(value) {
      var item = document.createElement('div')

      var rmButton = createButton('x')
      rmButton.style.paddingLeft = '4px'
      rmButton.style.paddingRight = '4px'
      rmButton.style.fontWeight = 'bold'
      rmButton.addEventListener('click', () => {
        item.remove()
        this.emit('change')
      })
      var upButton = createButton('▲')
      upButton.addEventListener('click', () => {
        this.moveItem(item, -1)
      })
      var downButton = createButton('▼')
      downButton.addEventListener('click',() => {
        this.moveItem(item, 1)
      })
      item.append(rmButton, upButton, downButton)

      var subargs = this.options.subargs || {}
      subargs.parent = this
      subargs.node = item
      var subInput = argumentTypes[this.options.type](subargs)
      if(value !== undefined) {
        // Do this asynchronously to let the value initialize first.
        setTimeout(() => {
          subInput.setValue(value)
          // Emitting a change event in part to ensure that state is updated.
          this.emit('change')
        }, 0)
      }
      this.listNode.appendChild(item)
      this.emit('change')
      subInput.on('change', () => {
        this.emit('change')
      })
    }

    this.value = function() {
      var result = []
      for(var n=0; n<this.listNode.children.length; n++) {
        result.push(this.listNode.children[n].inputObject.value())
      }
      return result
    }

    this.setValue = function(values) {
      if (!(values instanceof Array)) {
        throw new Error(`Trying to set value of list input to something other than a list value in ${findAncestorName(inputRegistry, this)}.`)
      }

      superclass.setValue.apply(this, arguments)

      // Clear any children.
      while(this.listNode.children.length !== 0) {
        this.listNode.removeChild(this.listNode.children[0])
      }

      values.forEach((value) => {
        this.addItem(value)
      })
    }

    // item - A dom node within this.listNode.
    // direction - Either 1 for down, or -1 for up.
    this.moveItem = function(item, direction) {
      var children = Array.prototype.slice.call(this.listNode.children)
      var index = children.indexOf(item)
      var newIndex = index + direction
      if(newIndex < 0 || children.length <= newIndex ) return // No more to go.

      if(newIndex === children.length - 1) {
        this.listNode.appendChild(item)
      } else {
        var beforeIndex = newIndex
        if(newIndex > index) {
          beforeIndex++
        }
        this.listNode.insertBefore(item, children[beforeIndex])
      }

      this.emit('change')
    }
  })

  // Maps a string to some type of input.
  // args:
    // type - the name of an argumentType (see argumentTypes list).
    // valueArgs
    // keyArgs
  var mapItem = proto(Input, function(superclass) {
    this.init = function() {
      superclass.init.apply(this, arguments)

      var itemKey = document.createElement('span')
      var keyInputType = this.options.keyType || "combobox"
      var keyArgs = this.options.keyArgs || {}
      keyArgs.parent = this
      keyArgs.node = itemKey
      this.argKey = argumentTypes[keyInputType](keyArgs)

      var itemValue = document.createElement('div')
      itemValue.style.display = 'inline-block'
      itemValue.style['vertical-align'] = 'top' // Display to the right of the key.

      var valueArgs = this.options.valueArgs || {}
      valueArgs.parent = this
      valueArgs.node = itemValue
      this.argValue = argumentTypes[this.options.valueType](valueArgs)

      this.node.append(itemKey, ": ", itemValue)

      this.argKey.on('change', () => {
        this.emit('change')
      })
      this.argValue.on('change', () => {
        this.emit('change')
      })
    }

    this.value = function() {
      return {key: this.argKey.value(), value: this.argValue.value()}
    }

    // list is expected to contain just one item
    this.setValue = function(item) {
      superclass.setValue.apply(this, arguments)
      this.argKey.setValue(item.key)
      this.argValue.setValue(item.value)
    }
  })

  // Maps a string to some type of input
  // args:
    // keyType - the name of an argumentType (see argumentTypes list).
    // valueType - the name of an argumentType (see argumentTypes list).
    // addButtonName
  var map = proto(list, function(superclass) {
    this.init = function(options) {
      var options = this.getArgs(options)

      if(!options.valueType) throw new Error("Missing `valueType` option to map.")

      options.subargs = {keyType: options.keyType, valueType: options.valueType, valueArgs: options.valueArgs, keyArgs: options.keyArgs}
      options.type = 'mapItem'
      superclass.init.call(this, options)
    }

    // this.value = function() {
    //   const result = {}
    //   for(const item of superclass.value.apply(this)) {
    //     result[item.key] = item.value
    //   }
    //
    //   return result
    // }
    //
    // this.setValue = function(mapValue) {
    //   const listValue = []
    //   for(const key in mapValue) {
    //     listValue.push({key, value: mapValue[key]})
    //   }
    //   superclass.setValue.apply(this, [listValue])
    // }
  })


  var hidden = proto(list, function(superclass) {
    this.init = function(options) {
      superclass.init.call(this, options)
    }
  })

  function override({id, options, _inputListId}) {
    const overridingInputClass = eval(options.subInputDescriptor._type)
    overridingInputClass({id, ...options.subInputDescriptor})

    if (options.mapInputDescriptor) {
      eval(`var mapFunction = `+JSON.parse(options.mapInputDescriptor.mapFunction))

      listeners.push(() => {
        const parentInput = getElementById(options.parentInputId).inputObject

        var inputNodes = options.mapInputDescriptor.inputNames.map((inputName) => getInputNode(_inputListId, inputName))
        for (const inputNode of inputNodes) {
          inputNode.inputObject.on('change', function() {
            parentInput.setValue(mapFunction(
              ...inputNodes.map((inputNode) => inputNode.inputObject.value())
            ))
          })
        }
      })
    }
  }

  // Gets the value of an Input and dynamically changes as the input changes.
  function input(inputListId, inputName, valueId) {
    inputMapping(inputListId, inputName, valueId, v => JSON.stringify(v))
  }

  function inputMapping(inputListId, inputName, valueId, mappingFn) {
    listeners.push(() => {
      var inputNode = getInputNode(inputListId, inputName)
      var valueNode = getElementById(valueId)
      inputNode.inputObject.on('change', function() {
        valueNode.innerHTML = mappingFn(inputNode.inputObject.value())
      })
    })
  }

  function createResetPageButton() {
    var button = resetPageButton()
    button.style.float = 'right'
    document.body.appendChild(button)
  }

  var argumentTypes = {
    textbox: textbox,
    combobox: combobox,
    list: list,
    mapItem: mapItem,
    map: map,
  }

  return {textbox, combobox, list, map, hidden, runInitializers, input, inputMapping, override, createResetPageButton}
})()

for (var exportName in moduleExports) {
  //eval('var '+exportName+' = moduleExports.'+exportName)
  window[exportName] = moduleExports[exportName]
}

// inputListId - Selects for which template to find the input in.
// inputName - The name of the input.
function getInputNode(inputListId, inputName) {
  // inputRegistry is a global variable written by modular-markdown.js
  const inputId = inputRegistry[inputListId][inputName]
  const element = getElementById(inputId)
  if (!element) {
    throw new Error("Can't find input node: "+inputName+" (in input list '"+inputListId+"')")
  }

  return element
}

function getElementById(id) {
    return document.getElementById(id)
}

function getHashArgument(key) {
  var matches = location.hash.match(new RegExp(key+'=([^&]*)'));
  return matches ? decodeURIComponent(matches[1]) : null;
}

var globalId = 0
function getId() {
  return globalId++
}

function replaceNode(id, content) {
  const nodeToReplace = document.getElementById(id)
  nodeToReplace.insertAdjacentHTML('beforebegin', content)
  nodeToReplace.remove()
}

function createButton(text) {
  var button = document.createElement('span')
  button.classList.add('button')
  button.innerText = text
  return button
}

function findTopAncestor(inputObject) {
  var cur = inputObject
  while(cur.options?.parent) {
    if(cur.options?.id) break
    cur = cur.options?.parent
  }
  return cur
}

function findAncestorName(inputRegistry, inputObject) {
  var topAncestor = findTopAncestor(inputObject)
  var inputListId = topAncestor.options._inputListId
  return searchForKey(inputRegistry[inputListId],topAncestor.options.id)
}

// Finds the first key that has the passed value.
function searchForKey(object, value) {
  for(var k in object) {
    if(object[k] === value) return k
  }
}

// This function is used for its string value. createButton is a global function.
function resetPageButton() {
  var button = createButton("Reset Page")
  button.addEventListener('click', function() {
    if(confirm("Are you sure you want to reset the page?")) {
      const origin = location.origin !== "null" ? location.origin : location.protocol+"//"
      window.location = origin+location.pathname
    }
  })
  return button
}



