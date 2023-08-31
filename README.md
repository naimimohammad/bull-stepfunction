# bull-stepfunction

[![GitHub License](https://img.shields.io/github/license/naimimohammad/bull-stepfunction)](https://github.com/naimimohammad/bull-stepfunction/blob/main/LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/naimimohammad/bull-stepfunction)](https://github.com/naimimohammad/bull-stepfunction/issues)

> A Node.js module for controlling queues and jobs using StepFunction JSON format with Bull queues.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Examples](#examples)
- [Contributing](#contributing)


## Introduction

`bull-stepfunction` is a Node.js module that provides the ability to control queues and jobs using StepFunction JSON format. It leverages the power of Bull queues to manage asynchronous tasks and offers an intuitive way to structure job execution using StepFunction-like syntax.

## Features

- Define job sequences using StepFunction JSON format.
- Integrate with Bull queues for efficient job processing.
- Improved control over complex job workflows.


## Installation

You can install `bull-stepfunction` using npm:

```sh
npm install bull-stepfunction
```

## Usage

```js
const {StepFunction} =require("bull-stepfunction");
const Queue =require("bull");
const path =require("path");

const testjobQ = require("./testJob")
const testjobQ1 = require("./testJob1")
const testjobQ2 = require("./testJob2")

const testQ = new Queue("fetch", "redis://127.0.0.1:6381");
const testQ1 = new Queue("fetch1", "redis://127.0.0.1:6381");
const testQ2 = new Queue("fetch2", "redis://127.0.0.1:6381");


testQ.process(20, testjobQ)
testQ1.process(20, testjobQ1)
testQ2.process(20, testjobQ2)

let sf = new StepFunction(path.join(__dirname, './simple.asl.json'),{testjob:testQ,testjob1:testQ1,testjob2:testQ2},{loging:false,redis:"redis://127.0.0.1:6381"})
sf.init({d:[{ss:"ss"},{dd:"dd"},{ff:"ff"}]})

sf.on('complete',(result)=>{
    console.log("step function process has been finished , final result is :",result)
})

```

first we import package with 

```js
const {StepFunction} =require("bull-stepfunction");

```

after that we define it with `new StepFunction`

```js
let sf = new StepFunction(path.join(__dirname, './simple.asl.json'),{testjob:testQ,testjob1:testQ1,testjob2:testQ2},{loging:false,redis:"redis://127.0.0.1:6381"})

```
this will get three arguments 
- path of stepfunction json
- the object map job from asl.json to job queue you defined in code 
- redis and loging configuration 

after that we init the class with data we want to pass to it 
```js
sf.init({d:[{ss:"ss"},{dd:"dd"},{ff:"ff"}]})

```

and we could run code in `complete` event

```js
sf.on('complete',({workflowId,data})=>{
    console.log("step function process has been finished ")
})
```
## Examples
For more examples, please check the examples directory.

## Contributing
Contributions are welcome! Please read the Contributing Guidelines for more information.
