const {StepFunction} = require("bull-stepfunction");
const Queue = require("bull");
const path = require("path");
const getValueJob = require("./getValue.js");

const getValueQ = new Queue("getValue", "redis://127.0.0.1:6381");


getValueQ.process(20, getValueJob);


const QMap = {GetValue:getValueQ}

let sf = new StepFunction(path.join(__dirname, './Parallel-Wait-Task.asl.json'),QMap,{loging:false,redis:"redis://127.0.0.1:6381"})
sf.init({key:1})
sf.on('complete',({workflowId,data})=>{
    console.log(`${workflowId} has been finished with result of ${JSON.stringify(data)}`)
})