# Modular Markdown

This module allows you to inherit markdown from one file to another and insert active components into markdown. 

To use this, you create javascript file that contains markdown and uses a suite of utility functions that are part of this module.

### Installation

```
npm install modular-markdown
```

### Usage

##### Processing a markdown template

```javascript
var {processDirectory} = require("../modular-markdown")
await processDirectory("input-directory", "output-directory")
```

`processDirectory(inputRoot, outputRoot, options)` - Traverses a directory and outputs one of three things into the `outputRoot`, in the same directory structure as that of `inputRoot`:

A. If its a modular markdown javascript template, process it into an html.
B. If its a basic markdown file, processes it into a static html file.
C. Otherwise, copies the file verbatim.

* `inputRoot` - A directory that will be traversed for modular-markdown template files.
* `outputRoot` - The directory that generated html files will be output to.
* `options` - Optional parameters with the following possible options:
  * `templateExtension` - (Default: ".mm.js") Files in the `inputRoot` with this file extension will be considered modular markdown (mm) templates and will be used to generate modular-markdown html files.
  * `ignorePaths` - (Default: []) Directories in the `inputRoot` to ignore. They should be paths relative to `inputRoot`.

`processFile(filename, templateExtension, inputRoot, outputRoot)` - Processes a single file

##### Creating a markdown template

To create a template, call the `template` function with a function that takes some parameters and returns markdown.

```javascript
var {template, textbox, /* other imports... */} = require("../modular-markdown")

module.exports = template(function(exampleParam1, exampleParam2) {
	return `
		# Example header
		
		Example text ${exampleParam1}
		
		## Another example header
		
		More example text ${exampleParam2}

		## Example header 3
		
		More example text
	`
}))
```

##### Merging markdown

To inherit from another markdown template, load the template as a module, call it similar to how a template is created, and export the result. Headers with the same name will be merged, the default being that the inherited text will appear first.

Headers can be prepended with a modifying character:

* b - Places content before inherited content.
* a - Places content after  the inherited content (this is the default).
* r - Replaces inherited content entirely.
* n - Renames the header to something else. The new header name should appear as a header on the line directly below and can also contain a post-pended operator. The name will map properly (sections within the previous heading will properly be matched to sections under the new heading). 

```javascript
var exampleTemplate = require("./ExampleTemplate.template.js") // Loading the example in the above section.

module.exports = exampleTemplate('example arg1', 'example arg2', function(exampleParam3) {
	return `
		b# Example header
		
		This example text will appear before the text from the template. ${exampleParam3}

		n## Example header 3

		## Replacement example header 3

		## Some other header
		
		This header will appear below the other two headers (named "Example header" and "Another example header")
	`
}))

```

##### Inputs

A markdown template can have up to one list of inputs. These are inputs that a user can interact with to change the page. When a template is inherited from another, its input list is also inherited.

```javascript
var {template, inputs, textbox, combobox} = require("modular-markdown")

module.exports = template(function() {
	return `
		# Example header
		
		${this.inputs({
        	Input1: {input: combobox({values: ['1', '2', '3']})},
        	Input2: {input: textbox()},
        	Input3: {input: textbox()},
        	Input4: {input: textbox()}
    	})}
	`
}))
```

```javascript
module.exports = exampleTemplate(function() {
	return `
		# Example header
		
		${this.inputs({
        	Input1: {input: override(hidden(), '3')}, // Hard coding the value to '3'
        	Input2: {input: override(
        		combobox({values: ["Alice", "Bob", "Carol"]}), 
        		mapInputs('Input2', 'Input1', function(input2Value, input1Value) {
                    // Gets the value of Input2 and Input1 and concatenates them 
                    // as the value that will be given to the parent Input2.
        			return input2Value + input1Value
        		}
        	)}
    	})}
	`
}))
```



* `this.inputs(mapOfInputs)` - Creates a inputs list for the template. Will inherit inputs from its parent template, inputs of the same name will override the parent. 
  * The key of each item in `mapOfInputs` will be both a label for the input and a unique name that can be used to reference the input. 
  * The value of each item in `mapOfInputs` should be an input element descriptor with the following properties:
    * `input` - An input element descriptor (returned by input element functions like `combobox`)
    * `link` - (*Optional*) A url to link the label to.
    * `desc` - (*Optional*) A description to write below the input.
    * `tooltip` - (*Optional*) A tooltip to display on hover over the input name. 

###### Input elements

The following functions create input element descriptors intended to be passed into `this.inputs`.

* `textbox({defaultValue, link}})`
  * `defaultValue` - A default value to insert.
* `combobox({defaultValue, values, link})` - A textbox with dropdown options.
  * `defaultValue` - A default value to insert.
  * `values` - An array of values to display for the combobox.
* `list({type, subargs, defaultValue, editable, addButtonName, link})` - A list of items of a particular type. 
  * `type` - The name of an input element this is a list of.
  * `subargs` - Arguments to pass to the sub input elements that make up the list.
  * `defaultValue`  - An element object that will be the default list item.
  * `editable` - If true, there's an "Add" button used to add items and 'x' buttons to remove items.
  * `addButtonName` - The label on the add button (default: 'Add Item')
* `map({keyType, keyArgs, valueType, valueArgs, defaultValue, editable, addButtonName, link})` - A list of items of a particular type.  
  * `keyType` - What type will be used for the key of the map. Should be the name of an input element this is a list of.
  * `valueType` - What type will be used for the key of the map. Should be the name of an input element this is a list of.
  * `keyArgs` - (*default: "combobox"*) Arguments to pass to the sub input elements that make up the keys.
  * `valueArgs` - Arguments to pass to the sub input elements that make up the values.
  * `defaultValue`  - An element object that will be the default list item.
  * `editable` - If true, there's an "Add" button used to add items and 'x' buttons to remove items.
  * `addButtonName` - The label on the add button (default: 'Add Item')
* `reposition()` - An input element that will be repositioned to the given place, rather than appearing in the default order. The default order is the parent inputs first, then child inputs. 
* `hidden()` - An input element that won't be displayed. This is intended to be used to hide overridden inputs. 
* `override(inputElementDescriptor, mapInputDescriptor)` - Overridden inputs must use this element. This overrides the name for use in the current template and mapping a value to the overridden input in the parent template. 
  * `inputElementDescriptor` - An input element descriptor that will replace the overridden one. 
  * `mapInputDescriptor` - If the `mapInputDescriptor` is the return value of the `mapInputs` function, it will map the described inputs to the overridden input. If it is not a function, it will use the passed value as the value to set for the overridden input.
    * `mapInputs(inputName1, inputName2, ..., mapFunction)` - Returns a descriptor that describes how to map inputs from the current template to an input of the parent template.
      * `inputName1`, `inputName2`, etc - Each of these should be the name of an input that the overridden input depends on.
      * `mapFunction(input1Value, input2Value, etc)` - A function whose return value will be used to set the value of the overridden input. Each function parameter is the value of the input corresponding to the names from the first arguments to `mapInputs` in the same order. **Note** that this function will be **called at runtime** and so doesn't have access to any template modules or variables (and should only really use other inputs to generate the resulting value.)

### Active elements

An active element changes based on the value of an input (or inputs).

* `this.input(name)` - Gets an object representing the input of the passed `name`. The return value has the following members:
  * `value` - This returns html that will actively update to the input value when the input value changes.
  * `map(callback)` - This will return an html element that will actively update. When the input value changes, the `callback` will be called with the input's value, and the active html element will get the value returned from the `callback`.  **Note** that this function will be **called at runtime** and so doesn't have access to any template modules or variables (and should only really use other inputs to generate the resulting value.)

### Developing modular-markdown

* Run `node build.js` to update the generated `runtimeUtils` bundle in dist. 
* Run `node test-generate.js` to build the test templates, which you can then open the html files without a webserver.