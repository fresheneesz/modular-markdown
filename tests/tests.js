var Unit = require('deadunit')

var {trimIndent, fixFirstlineIndent, trimFinalEmptyLine, findMainIndent, strmult} = require("../template-utils")

var test = Unit.test('Everything', function(t) {

    this.test('trimIndent', function(t) {
        this.ok(trimIndent("") === "")
        this.ok(trimIndent("Whatever and ever") === "Whatever and ever")
        this.ok(trimIndent("Whatever \nand ever") === "Whatever \nand ever")
        this.ok(trimIndent("Whatever \nand ever\n") === "Whatever \nand ever")
        this.eq(trimIndent("\nWhatever \nand ever\n"), "Whatever \nand ever")
        this.eq(trimIndent("\n   Whatever \n   and ever\n"), "Whatever \nand ever")
        this.eq(trimIndent("   Whatever \n   and ever\n"), "Whatever \nand ever")
    })
})

test.writeConsole() // writes colorful output!

