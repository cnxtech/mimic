/// <reference path="util/assert.d.ts" />

// activate ES6 proxy proposal
import harmonyrefl = require('harmony-reflect');
harmonyrefl;
declare var Proxy: (target: any, handler: any) => any;

import Util = require('./util/Util')
import Data = require('./Data')
import Recorder = require('./Recorder')
import InputGenerator = require('./InputGenerator')
import Verifier = require('./Verifier')
import ansi = require('./util/Ansicolors')
import _difflib = require('./util/difflib')
var difflib = _difflib.difflib

var print = Util.print
var log = Util.log


function run(f, args) {

    print("")
    var state = Recorder.record(f, args)
    Util.line()
    print(ansi.green(state.toString()))
    Util.line2()
}


// --------------------------
/*
function push(a, b) {
    return a.push(b);
}

function pop(a) {
    return a.pop();
}

function defineProp(o, f, v) {
    Object.defineProperty(o, f, {value : v});
    return o[f]
}

function id(a, b) {
    return b
}

function f2(o) {
    o.f = o.g
    o.h = o.g
    return o.h
}

run(pop, [["a", "a"]])
run(push, [["a"], "b"])
run(defineProp, [{}, "field", 42])
run(id, ["a", "a"])
run(f2, [{g: {}}])
*/

/*
function f(o, a, b) {
    o.f = a
    return b
}
var s = Recorder.record(f, [{}, "a", "a"])
var candidates = Recorder.generateCandidates(s);
log(candidates.length)
candidates = candidates.filter((c) => {
    return Verifier.isModel(c, f, [{}, "a", "a"])
})
log(candidates.length)
candidates = candidates.filter((c) => {
    return Verifier.isModel(c, f, [{}, "a", "b"])
})
log(candidates.length)
candidates = candidates.filter((c) => {
    return Verifier.isModel(c, f, [{}, "b", "a"])
})
log(candidates.length)

print(candidates.join("\n\n"))
*/

function infer(f, args) {
    var status = (s) => print(ansi.green(s))

    status("the function to be processed is:")
    print(f.toString())
    status("initial set of arguments")
    log(args, false)

    status("recording an initial trace: ")
    var s = Recorder.record(f, args)
    print(s.trace)

    var candidates = Recorder.generateCandidates(s);
    status("generated " + candidates.length + " candidate implementations based on this trace.")

    var inputs = InputGenerator.generateInputs(s, args)
    status("generated " + inputs.length + " inputs based on this trace.")
    inputs.forEach((a) => {
        log(a, false)
    })

    status("running validation for candidates. remaining candidates:")
    Util.printnln(candidates.length + " ")
    for (var i = 0; i < inputs.length; i++) {
        candidates = candidates.filter((c) => {
            return Verifier.isModel(c, f, inputs[i])
        })
        Util.printnln(candidates.length + " ")
    }
    print("")

    if (candidates.length === 0) {
        status("no candidate left :(")
    } else if (candidates.length === 1) {
        status("one candidate program left:")
        print(candidates[0])
    } else {
        status(candidates.length + " many candidates left:")
        print(candidates.join("\n\n"))
    }
}

function f(obj1, obj2, str, int) {
    obj1.a = obj2
    obj2[str] = obj2.g
    obj2[str] = "b"
    obj1.f2 = obj2.f
    return 0
}
var args = [{}, {g: "a", f: {}}, "a", 0]

//infer(f, args)




/*
var p = Recorder.proxifyWithLogger([])
p.pop()
print(Recorder.record((a) => a.pop(), [[]]).trace)
Util.line()
p.push("a")
print(Recorder.record((a) => a.push("a"), [[]]).trace)
Util.line()
p.pop()
print(Recorder.record((a) => a.pop(), [["a"]]).trace)
Util.line()
print(Recorder.record((a) => a.pop(), [["b", "c"]]).trace)
Util.line()

p = Recorder.proxifyWithLogger(["a"])
function pop(a) {
    var l = a.length
    if (l == 0) return undefined
    var r = a[l-1]
    delete a[l-1]
    return r
}
pop(p)

*/


function get_diff(a, b) {
    return new difflib.SequenceMatcher(a, b).get_opcodes()
}


var p1 = new Data.Trace([
    <Data.Stmt>new Data.Assign(new Data.Field(new Data.Argument(0), new Data.Const("g")), new Data.Const(1)),
    <Data.Stmt>new Data.Assign(new Data.Field(new Data.Argument(0), new Data.Const("f")), new Data.Const(1)),
    <Data.Stmt>new Data.Return(new Data.Const(200)),
])
var p2 = new Data.Trace([
    <Data.Stmt>new Data.Assign(new Data.Field(new Data.Argument(0), new Data.Const("f")), new Data.Const(2)),
    <Data.Stmt>new Data.Return(new Data.Const(200)),
])


var DISTANCE_NORM = 100000
function stmtDistance(real: Data.Stmt, candidate: Data.Stmt) {
    Util.assert(real.type === candidate.type)
    var l, r
    switch (real.type) {
        case Data.StmtType.Assign:
            l = <Data.Assign>real
            r = <Data.Assign>candidate
            return exprDistance(l.lhs, r.lhs)/2 + exprDistance(l.rhs, r.rhs)/2
        case Data.StmtType.Return:
            l = <Data.Return>real
            r = <Data.Return>candidate
            return exprDistance(l.rhs, r.rhs)
        default:
            Util.assert(false, "unhandeled stmt distance: " + real)
    }
}

function exprDistance(real: Data.Expr, candidate: Data.Expr) {
    Util.assert(real.type === candidate.type)
    var l, r
    switch (real.type) {
        case Data.ExprType.Arg:
            if ((<Data.Argument>real).i === (<Data.Argument>candidate).i) {
                return 0
            }
            return DISTANCE_NORM
        case Data.ExprType.Field:
            l = <Data.Field>real
            r = <Data.Field>candidate
            return exprDistance(l.o, r.o)/2 + exprDistance(l.f, r.f)/2
        case Data.ExprType.Const:
            l = (<Data.Const>real).val
            r = (<Data.Const>candidate).val
            if (l === r) {
                return 0
            }
            if (typeof l !== typeof r) {
                return DISTANCE_NORM
            }
            if (typeof l === 'number') {
                return Math.min(Math.abs(l-r), DISTANCE_NORM)
            }
            Util.assert(false, "unhandled const distance: " + real + " - " + candidate)
            return 0
        default:
            Util.assert(false, "unhandled expr distance: " + real)
    }
}

function traceDistance(real: Data.Trace, candidate: Data.Trace): number[] {
    var diff = get_diff(real.toSkeleton(), candidate.toSkeleton())
    var diffLength = diff.length
    var nonSkeletonDiff = 0
    var skeletonDiff = 0
    for (var i = 0; i < diffLength; i++) {
        var d = diff[i]
        if (d[0] === 'delete') {
            skeletonDiff++
            continue
        }
        if (d[0] === 'equal') {
            for (var i = 0; i < d[2]-d[1]; i++) {
                var left = real.getSkeletonIdx(d[1]+i)
                var right = candidate.getSkeletonIdx(d[3]+i)
                nonSkeletonDiff += stmtDistance(left, right)
            }
        } else {
            Util.assert(false, "unknown tag: " + d[0])
        }
    }
    return [skeletonDiff, nonSkeletonDiff]
}


function randomChange(state: Recorder.State, p: Data.Program): Data.Program {
    return null
}



var s = Recorder.record((() => {
    throw "noop"
}), [])

print(s)


print(p1.toSkeleton().join("\n"))
print(p2.toSkeleton().join("\n"))

//print(get_diff(p1.toSkeleton(), p2.toSkeleton()).join("\n"))

print(traceDistance(p1, p2))
