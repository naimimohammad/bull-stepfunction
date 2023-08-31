## Introduction
this example we have 3 queue with some data input

we defined `asl.json` 

![alt text](https://github.com/naimimohammad/bull-stepfunction/blob/master/examples/Map-Task/Map-Task.asl.png?raw=true)

```json
{
    "StartAt": "GetValue",
    "States": {
        
        "GetValue":{
            "Type": "Map",
            "Next": "Filter",
            "ItemsPath":"$.keys",
            "Iterator": {
                "StartAt": "Fetch",
                "States": {
                    "Fetch": {
                        "Type": "Task",
                        "Resource": "GetValue",
                        "Next": "ConvertToInt"
                    },
                    "ConvertToInt": {
                        "Type": "Task",
                        "Resource": "ConvertValue",
                        "End":true
                    }
                   
                }
            }
        },
        "Filter":{
            "Type": "Task",
            "Resource": "FilterValues",
            "End": true
        }
    }
}



``` 


the process start from `GetValue` and we pass data of 

```js
{keys:[{key:1},{key:2},{key:3},{key:4},{key:5}]}
```

to stepfunction we defined `ItemPath` as `$.Keys`
means for every Item in `Keys` it will run Fetch Task with Resource of `GetValue` we defined in index.js like this 

```js
const QMap = {GetValue:getValueQ,ConvertValue:convertValueQ,FilterValues:filterValuesQ}

```
the process flow in this example start geting value of key by `GetValueQ`  , in each Iterration data passed to    `ConvertValueQ`
and when All Iteration finished the result of all iteration merged and passed to `FilterQ` and workflow will be finished 