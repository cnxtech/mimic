# Replication Package Instructions

These are instructions to reproduce the results in our paper "Mimic: Computing Models for Opaque Code" in FSE'15.

The virtual machine contains a clone of our [GitHub repository](https://github.com/Samsung/mimic) in the directory `~/mimic`, and the user should start a terminal and navigate to that folder using `cd ~/mimic` as the first step upon booting the virtual machine.  We encourage reviewers to read our updated version of the paper, as it contains an important correction as well as an improved evaluation section.

## Claims

This artifact was used to obtain all results in the paper, and can be used to replicate these results, and experiment with the prototype beyond what is discussed in the paper.  Note that we cannot give guarantees about the applicability of `mimic` to other domains;  there may be technical limitations like the experimental proxy support in `node.js`.  Furthermore, our prototype has not been tuned for wide adoption and instead serves as a proof of concept.

The paper evaluates `mimic` on five research questions, and in this document we explain how to reproduce the answers to all of these questions.  But first, we give a brief overview of the artifact and the usage of `mimic`.

## Usage and Overview

`mimic` is open source and available at [github.com/Samsung/mimic](https://github.com/Samsung/mimic).  The `README.md` file contains instructions on how to install and run the tool.  The virtual machine we provide for the FSE Replication Packages Evaluation Committee has `mimic` installed and this guide should cover all necessary information.  The artifact also contains the full source code.

The main way to invoke the tool is via the script `mimic`.  It requires as input a function (for which a model should be computed) as well as some initial inputs.  To start, lets consider a trivial example and synthesize a model for the identity function:

    ./mimic --function "return x" --argnames "x" --arguments "1" "2"

We provide the body of the function to be synthesized (`return x` here), as well as two sample inputs (`1` and `2`).  `mimic` should be able to find a model for this trivial example in no time.  Note that while we pass the code of the body to `mimic`, the tool does not look at the source and only uses it to execute it.  Furthermore, the code might contain calls to native functions like those from the standard library.

In the paper we consider the array standard library, and we could synthesize models for those functions in the same way.  To make things a bit easier, we have collected the functions from Table 1 in the paper in `tests/array.json`, and wrote a script to use that information to pass it to mimic.  For instance, to synthesize code for `Array.prototype.pop`, we can simply run

    scripts/example.py pop

This will actually show the command that is used to invoke `mimic`.  The tool is now taking a bit more time.  `mimic` can run highly parallel, and depending on the machine it is run on, synthesis can take more or less time.  Hint: Use `--threads <n>` to control the number of threads that `mimic` should use (the number defaults to half the number of processors available).

To see how `mimic` works in more detail, we can pass the parameter `--debug` to `mimic` (or `scripts/example.py`, which just forwards parameters).  If we run

    scripts/example.py pop --debug

then `mimic` will only invoke one copy of `mimic-core` and show various additional information on what is going on.  Since this just runs `mimic-core` once, the search may not converge (or fail), but if it is repeated often enough, eventually `mimic` will find a model.  It works best to kill `mimic-core` (using Ctrl+C) after a while, and retry with a new random seed (which is automatically chosen).  Of course, when we run `mimic` (rather than `mimic-core` via `--debug`), many runs of `mimic-core` are done automatically, and there is no need to manually restart.

## Replication Instructions

Now that we have a basic understanding on how to run `mimic`, we can turn our attention to reproducing the results in the paper.

### RQ1: Success Rate

We claim in Table 1 that `mimic` is able to find a model for 15 functions.  This can be reproduced by running

    scripts/example.py <function>

for all 15 different functions.  Note that depending on your hardware, it may take significantly more time to find the models (see next section).

### RQ2: Performance

Reproducing performance results requires the same hardware and likely `mimic` should be run natively (and not in a VM).  We used an Intel Xeon CPU E5-2697 (which has 28 physical cores).  On other machines the numbers may be different.  If you would like to reproduce these numbers, we urge you to run `mimic` natively (and not in a VM).  In particular, the VM likely has only one (virtual) CPU, which means that `mimic` will not be able to make use of any parallelism.

The performance numbers are obtained with 100 repetitions for all functions, and we actually additionally use two different fitness functions (to answer RQ5), which results in `15*100*2 = 3000` individual runs.  On our hardware, this took just over 58 hours.

The experiment can be run by invoking `make experiment`, which runs the following command (be aware that this will take a long time to complete)

    scripts/experiment.py --exp_name "main" -n 100 --metric "0,1"

It is possible to only reproduce some of the table (so that the experiment takes less time).  For instance, to only do 10 repetitions, only use the default fitness function and only run the experiment for the function `Array.prototype.pop`, invoke:

    scripts/experiment.py --exp_name "pop_only" -n 10 --metric "0" --filter "pop"

This should be significantly faster than the full run, but might still take anywhere from minutes to hours (depending on the hardware).  Note that `scripts/experiment.py` only collects the data and stores it in an output folder in `tests/out`, but does not analyze it.  For the analysis, we use `scripts/process.py`.

In our package we include the data gathered by our own experimental run, so the next step will work even if you have not (yet) run `scripts/experiment.py` yourself.  To analyze this data, run

    scripts/process.py --folder tests/out/2015-06-05_paper_data

If you have generated your own experimental data, change the folder above accordingly.  This generates a table as well as some aggregate statistics on the console, and can also produce the LaTeX table in the paper (Table 1).  The output also contains all other aggregate values found in the paper, like the average and maximum cleanup times reported in the paper.

### RQ3: Usefulness

The `mimic`-generated models accepted into WALA can be seen [here](https://github.com/wala/WALA/pull/64/files).  Here is an example program whose analysis benefits from the `mimic` models for `reduce`, `every`, and `some`:

```javascript
function a() {
  return false;
}

function b() {
  return a();
}


var x = [1,3,5];
console.log(x.some(b));

function c(i) {
  return i%2 === 1;
}

console.log(x.every(c));

function add(previousValue, currentValue, index, array) {
  return previousValue + currentValue;
}

var y = [0,1,3,5,2];
console.log(y.reduce(add));
```

Without the `mimic` models, when WALA constructed a call graph for the above code, it would erroneously conclude that functions `a`, `b`, `c`, and `add` were dead code.  With the `mimic` models, WALA observed the callbacks from the library functions to these methods, and its call graph correctly identifies the methods as live.  For further details on actually running WALA to generate call graphs, see the [WALA Getting Started Guide](http://wala.sourceforge.net/wiki/index.php/UserGuide:Getting_Started).

### RQ4: Obfuscation

For this experiment, we start with the model that `mimic` found (see `models/array.js`).  For instance, for `Array.prototype.pop`, this code would be

```javascript
function pop(arg0) {
  var n0 = arg0.length
  if (n0) {
    var n1 = arg0[n0-1]
    arg0.length = n0-1
    delete arg0[n0-1]
    return n1
  } else {
    arg0.length = 0
  }
}
```

We take the function body, and pass it through the obfuscator at [javascriptobfuscator.com](http://www.javascriptobfuscator.com/Javascript-Obfuscator.aspx).  This yields a new body like the following:

```javascript
var _0x6339=["\x6C\x65\x6E\x67\x74\x68"];var n0=arg0[_0x6339[0]];if(n0){var n1=arg0[n0-1];arg0[_0x6339[0]]=n0-1;delete arg0[n0-1];return n1;}else {arg0[_0x6339[0]]=0};
```

We can run `mimic` directly by passing the string as the `--function` parameter:

    ./mimic --function 'var _0x6339=["\x6C\x65\x6E\x67\x74\x68"];var n0=arg0[_0x6339[0]];if(n0){var n1=arg0[n0-1];arg0[_0x6339[0]]=n0-1;delete arg0[n0-1];return n1;}else {arg0[_0x6339[0]]=0};' --argnames "arg0" --arguments "[1,2,3,4]"

`mimic` should successfully be able to recover a human-readable model.  This can be done for all examples in a similar manner.

### RQ5: Fitness Function

The steps to evaluate RQ2 actually also answer this question, as `mimic` is run with both fitness functions in the experiment.  In particular, the output of `scripts/process.py` appears in Section 5.2 of the paper.
