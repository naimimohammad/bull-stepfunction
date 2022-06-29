import { StepFunction } from ".";

let s = new StepFunction('../src/2.asl.json',{})
let ss = new StepFunction('../src/4.asl.json',{})
// s.init({d:["ss","dd","SS",2,3]})
s.init({d:["DD","VV"]})
ss.init({d:[1,2,3,4,5,6,6,7,7,8]})

