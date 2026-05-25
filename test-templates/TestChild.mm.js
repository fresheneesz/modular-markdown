var {template, textbox, combobox, list, map, override, mapInputs} = require("../modular-markdown")

var basicTemplate = require("./Test.mm.js")

module.exports = basicTemplate('test param', function() {
    return `
        Adding this
        
        Original textbox 1 content: ${this.input("Textbox 1").value}
        
        New textbox 2 content: ${this.input("Textbox 2").value}
        
        New combobox 2 content: ${this.input("Combobox 2").value}
        
        New textbox list 2 content: ${this.input("Textbox List 2").value}
        
        New textbox map 2 content: ${this.input("Textbox Map 2").value}
        
        Textbox map 4 content: ${this.input("Textbox Map 4").value}
        
        Textbox in child content: ${this.input("Textbox In Child").value}
        
        

        # Basic test

        Adding more

        ##b Section A

        First
        
        Inputs at the end:

        ${this.inputs({
            "Textbox 2": {input: override(
              textbox({defaultValue: "new text"}), 
              mapInputs("Textbox 2", "Combobox 1", function(BValue, CValue) {
                return 'overriding yo ('+BValue+' '+CValue+')'
              })
            )},
            "Combobox 2": {input: override(combobox({
                values: ['999', '99999']
            }))},
            "Textbox List 2": {input: override(list({
                type: 'textbox',
                subargs: {defaultValue: 'item value'}
              }), mapInputs("Textbox List 2", 
                function(listItems) {
                  return ['The mapped list items:', ...listItems]
                }
              )
            )},
            "Textbox Map 2": {input: override(map({
                valueType: 'textbox', keyType: 'textbox',
              }), mapInputs("Textbox Map 2", function(mapItems) {
                return [{key: 34, value: 'moose'}]
                // return [...mapItems, {key: 34, value: 'moose'}]
            }))},
            "Textbox Map 4": {input: map({
              valueType: 'textbox', keyType: 'textbox',
              defaultValue: [{key:'A', value: 'B'}],
            })},
            "Textbox In Child": {input: textbox()},
        })}

        ##a Section B

        Second

        ##r Section R

        This replaced what was here
    `
})