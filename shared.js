// This file contains functions shared between both the runtime and the node.js generation code.

function createClassName(name) {
    return name.replace(/ /g, '')
}

if (typeof exports !== 'undefined') {
  exports.createClassName = createClassName
}