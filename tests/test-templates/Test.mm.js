var {template, textbox, combobox, list, map, override, mapInputs} = require("../../modular-markdown")

module.exports = template(function(parameter) {
    return `
        # Test
        
        Top text test. [Test doc link](test-doc.md). And [External doc link](https://github.com/kopia/kopia/blob/master/README.md)

        Original textbox 1 content: ${this.input("Textbox 1").value}
        
        Original Combobox 1 content: ${this.input("Combobox 1").value}
        
        Original textbox 2 content: ${this.input("Textbox 2").value}

        Original combobox 2 content: ${this.input("Combobox 2").value}

        Original textbox list 2 content: ${this.input("Textbox List 2").value}

        Original textbox map 2 content: ${this.input("Textbox Map 2").map(v => {return JSON.stringify(v)})}

        Original textbox map 3 content: ${this.input("Textbox Map 3").map(function(v) {return JSON.stringify(v)})}

        Dynamic markdown test: 
        ${this.input(`Textbox Map 2`).map(configuration => 
          configuration.map(({key:items, value:location}) => `* Put ${items} in ${location}`).join('\n')
        )}

        Map to number test: ${this.input("Textbox List 2").map(v => 2)}

        # Basic test

        The passed parameter: ${parameter}

        ## Section A
        Section A text

        ## Section B
        Section B text
        
        ## Move me from below Section B to above it
        
        ## Inputs
        
        ${this.inputs({
            "Textbox 1": {
              link: 'test-doc.md', desc: "This describes what the textbox is for. [link in desc](test-doc.md) and "+this.input("Textbox Map 2").value, 
              input: combobox({defaultValue: 'moose'})
            },
            "Textbox 2": {input: combobox({defaultValue: 'moose'}), desc: "Original textbox 1 content in desc: "+this.input("Textbox 1").value},
            "Unoverridden textbox": {input: combobox({defaultValue: 'unoverridden'}), desc: "Original textbox 1 content in desc: "+this.input("Textbox 1").value},
            "Combobox 1": {
              input: combobox({
                defaultValue: '100',
                values: ['50', '80', '100', '120']
              })
            },
            "Combobox 2": {input: combobox({
              defaultValue: '50',
              values: ['50', '80', '100', '120', '150']
            })},
            "Textbox List 1": {input: list({
              type: 'combobox',
              subargs: {defaultValue: 'item value'}
            })},
            "Textbox List 2": {input: list({
              type: 'combobox', defaultValue: [1,2,3]
            })},
            "Textbox Map 1": {input: map({
              keyType: 'combobox',
              keyArgs: {
                defaultValue: 'default value',
              },
              valueType: 'combobox',
              valueArgs: {
                defaultValue: 'default value',
                values: ['m50', 'm80', 'm100', 'm120', 'm150']
              },
              addButtonName: 'Add to Map',
              defaultValue: [{key:'On Your Person', value: 'Host Device'}],
            })},
            "Textbox Map 2": {input: map({
              keyType: 'combobox', valueType: 'combobox',
              defaultValue: [{key:'A', value: 'B'}],
            })},
            "Textbox Map 3": {input: map({
              keyType: 'combobox',
              keyArgs: {
                defaultValue: 'default value',
              },
              valueType: 'list',
              valueArgs: {
                type: 'combobox', defaultValue: [1,2,3]
              },
              addButtonName: 'Add to Map',
              defaultValue: [{key:'On Your Person', value: ['a','b','c']}]
            })},
            // To actually test this, you annoyingly need to unhide the child input block so you can see if the input set that's later on the page gets the correct value.
            "Don't override this": {
              desc: "Inherit this: "+this.input("Textbox 1").value, 
              input: combobox()
            },
        })}

        Make sure this says "moose": ${this.input("Don't override this").map(v => "moose")}
        
        Same input as the above but its actual value: ${this.input("Don't override this").value}
        
        Same input as the above but its actual value mapped: ${this.input("Don't override this").map(v => v)}

        ## Section R
        This will be replaced
        * Testing final bullet point
        `
})


// Errors:
// module.exports = basicTemplate(function() {
//     return `
//         Should throw an error: ${this.input("nonexistent")}
//
//         ${this.inputs({
//             "Textbox 1": combobox({link: 'http://www.google.com', defaultValue: 'moose'}),
//             "Textbox 2": combobox({defaultValue: 'moose'}),
//             "Combobox 1": combobox({
//               link: 'http://www.google.com',
//               defaultValue: '100',
//               values: ['50', '80', '100', '120']
//             }),
//             "Combobox 2": combobox({
//               defaultValue: '50',
//               values: ['999', '99999']
//             })
//         })}
//
//         ##z Wrong postfix
//         `
// })