## Introduction 

In this example we use `Parallel`,`Task` and `Wait`

![alt text](https://github.com/naimimohammad/bull-stepfunction/blob/master/examples/Parallel-Wait-Task/Parallel-Wait-Task.asl.png?raw=true)


when we start stepfunction the data will be duplicated and passed through each branch of `Parallel`
in one of branches we have `Task` it will fetch some data from server via axios 
and another branch has `Wait` and waits for 10 seconds as we defined in asl.json
