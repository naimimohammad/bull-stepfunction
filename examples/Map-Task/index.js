const {StepFunction} = require("bull-stepfunction");
const Queue = require("bull");
const path = require("path");
const getValueJob = require("./getValue.js");

const getValueQ = new Queue("getValue", "redis://127.0.0.1:6381");
getValueQ.process(20, getValueJob);

let sf = new StepFunction(path.join(__dirname, './Map-Task.asl.json'),{GetValue:getValueQ},{loging:false,redis:"redis://127.0.0.1:6381"})
sf.init({keys:[{key:1},{key:2},{key:3},{key:4},{key:5}]})
sf.on('complete',({workflowId,data})=>{
    console.log(`${workflowId} has been finished with result of ${data}`)
})