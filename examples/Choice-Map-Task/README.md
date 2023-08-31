## Introduction

![alt text](https://github.com/naimimohammad/bull-stepfunction/blob/master/examples/Choice-Map-Task/Choice-Map-Task.asl.png?raw=true)

this example we use `Map` inside of it we call `Task` and after that we use `Choice` to filter result 
the result greaterThan 10 as we defined in `asl.json` goes to `NextState` and otherwise goes to `DefaulState`
and it has type of `Wait` 