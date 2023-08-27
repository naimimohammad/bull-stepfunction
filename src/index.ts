import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import t from "typy";
import _ from "lodash";
import jp from "jsonpath";
import { Choice } from "aws-sf-choice";
import V from "./libs/newdb";
import { DBCon } from "./libs/db";
import Queue from "bull";
import { EventEmitter } from 'events'


export class StepFunction extends EventEmitter {
  workflow: any;
  workflowId!: string;
  resources: any;
  jsonPath!: string;
  redis!: String;
  typeId: any = {};
  posId: any = {};
  IdinId: any = {};
  EndIdinId: any = {};
  IdLength: any = {};
  IdResult: any = {};
  DB: any = {};
  onCompleteQueue :any
  startQueue:any;
    constructor(jsonPath: string, resources: any, redis:any ) {
      super()
    this.DB = new DBCon(redis);
    this.jsonPath = jsonPath;
    this.resources = resources;
    this.onCompleteQueue = new Queue('onCompleteState',redis)
    this.startQueue = new Queue('startQueue',redis)
    this.startQueue.process(100,(job:any,done:any)=>{
      let data = {...job.data}
      console.log(`${data[2]} at position ${data[4]} started`)
      this.start(data[0],data[1],data[2],data[3],data[4],data[5])
      done()
    })
    this.onCompleteQueue.process(1,async (job:any,done:any)=>{
      let data = {...job.data}
      console.log(`${data[0]} at position ${await this.DB.Get('PosId',data[3])} finished`)
      await this.onCompleteState(data[0],data[1],data[2],data[3],data[4])
      done()
    })
    this.workflow = JSON.parse(
      // fs.readFileSync(path.join(__dirname, jsonPath), {
      fs.readFileSync(jsonPath, {
        encoding: "utf-8",
      })
    );
  }

  
  
  async init(data: any) {
    let workflowId = uuidv4();
    await this.DB.Set('workflow',workflowId,this.jsonPath)

    await Promise.all([
      this.DB.Set("TypeId", workflowId, "root"),
      this.DB.Set("PosId", workflowId, "States"),
    ]);

  
    let type = this.workflow.States[this.workflow.StartAt].Type;
    let jsonData = t(
      this.workflow,
      `States.${this.workflow.StartAt}`
    ).safeObject;
   
    
    this.startQueue.add([
      data,
      jsonData,
      type,
      workflowId,
      `States.${this.workflow.StartAt}`
    ])
  }
  async start(
    data: any,
    jsonData: any,
    type: string,
    upperId: string,
    posPath: string,
    index?:number
  ) {

    
    switch (type) {
      case "Map": {
        let workflowId: string = uuidv4();
        let ItemsPath = jsonData.ItemsPath;
        let MapData = jp.query(data, ItemsPath)[0];

        await Promise.all([
          this.DB.Set("TypeId", workflowId, type),
          this.DB.Set("IdinId", workflowId, upperId),
          this.DB.Set("PosId", workflowId, posPath),
          this.DB.Set("IdLength", workflowId, MapData.length),
          this.DB.Set('IndexId',workflowId,index),
          this.DB.CreateInitResult(workflowId, MapData.length),
        ]);

        for (let [index, datain] of MapData.entries()) {
          let nposPath = `${posPath}.Iterator.States.${jsonData.Iterator.StartAt}`;
          let ntype = t(this.workflow, nposPath).safeObject.Type;         
          this.startQueue.add([
            datain,
            t(this.workflow, nposPath).safeObject,
            ntype,
            workflowId,
            nposPath,
            index
          ])
        }
        break;
      }
      case "Parallel": {
        let workflowId: string = uuidv4();

        await Promise.all([
          this.DB.Set("TypeId", workflowId, type),
          this.DB.Set("IdinId", workflowId, upperId),
          this.DB.Set("PosId", workflowId, posPath),
          this.DB.Set("IdLength", workflowId, jsonData.Branches.length),
          this.DB.Set('IndexId',workflowId,index),
          this.DB.CreateInitResult(workflowId, jsonData.Branches.length),
        ]);


        for (let [index, States] of jsonData.Branches.entries()) {
          let njsonData = States;
          let nposPath = `${posPath}.Branches[${index}].States.${njsonData.StartAt}`;
          let ntype = t(this.workflow, nposPath).safeObject.Type;
         
          this.startQueue.add([
               data,
            t(this.workflow, nposPath).safeObject,
            ntype,
            workflowId,
            nposPath,
            index
          ])
        }
        break;
      }
      case "Task": {
        let workflowId: string = uuidv4();

        await Promise.all([
          this.DB.Set("TypeId", workflowId, type),
          this.DB.Set("IdinId", workflowId, upperId),
          this.DB.Set("PosId", workflowId, posPath),
          this.DB.Set('IndexId',workflowId,index),

        ]);

        this.resources[jsonData.resources].add(data, { jobId: workflowId });
        break;
      }
      case "Wait": {
        let workflowId: string = uuidv4();

        await Promise.all([
          this.DB.Set("TypeId", workflowId, type),
          this.DB.Set("IdinId", workflowId, upperId),
          this.DB.Set("PosId", workflowId, posPath),
          this.DB.Set('IndexId',workflowId,index),

        ]);

        await this.sleep(jsonData.Seconds);
        this.onCompleteQueue.add([type, upperId, data, workflowId,index],{removeOnComplete:true})
        break;
      }
      case "Pass": {
        let workflowId: string = uuidv4();
        await Promise.all([
          this.DB.Set("TypeId", workflowId, type),
          this.DB.Set("IdinId", workflowId, upperId),
          this.DB.Set("PosId", workflowId, posPath),
          this.DB.Set('IndexId',workflowId,index),

        ]);

       
        this.onCompleteQueue.add([type, upperId, data, workflowId,index],{removeOnComplete:true})

        break;
      }
      case "Choice": {
        let choice = new Choice(jsonData, data);
        let next: any = await choice.start();
        let currentPosPathArr = posPath.split(".");
        let nextpospath = posPath.replace(
          currentPosPathArr[currentPosPathArr.length - 1],
          next
        );
       
        this.startQueue.add([
            data,
          t(this.workflow, nextpospath).safeObject,
          t(this.workflow, nextpospath).safeObject.Type,
          upperId,
          nextpospath,
          index
        ])
        break;
      }
    }
  
  }

  async jobComplete(job: any) {
    this.onCompleteState(
      "Task",
      await this.DB.Get("IdinId", job.opts.jobId),
      job.data,
      job.opts.jobId
    );
  }
  private sleep(s: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, s * 1000);
    });
  }
  resultTracker(id: string) {}

  async onCompleteState(
    type: string,
    upperId: string,
    data: any,
    currentId: string,
    index?:number
  ) {
    try {
      if ((await this.DB.Get("TypeId", currentId)) == "root") {
        await this.DB.Set('IdResult',currentId,data)
        console.log("workflow finished",await this.DB.Get('IdResult',currentId));
        this.emit('complete',{workflowId:currentId,data:data})
      } else {
        if (await this.endDetection(currentId)) {
          switch (await this.DB.Get("TypeId", upperId)) {
            case "Parallel": {
              await Promise.all([
                this.DB.Set("IdResult", currentId, data),
                this.DB.Set("EndIdinId", currentId, upperId),
                this.DB.pushResult(upperId, data,await this.DB.Get('IndexId',currentId)),
              ]);
              let ParallelResult = await this.DB.getResult(upperId);
              let ParallelResultLength = await this.DB.getDone(upperId);
              if (
                ParallelResultLength == (await this.DB.Get("IdLength", upperId))
              ) {

                await this.DB.Set("IdResult", upperId, ParallelResult);
                this.onCompleteQueue.add([
                  await this.DB.Get("TypeId", upperId),
                   await this.DB.Get("IdinId", upperId),
                     ParallelResult,
                     upperId,
                     await this.DB.Get('IndexId',upperId)],{removeOnComplete:true})

               
              }
              break;
            }
            case "Map": {
              await Promise.all([
                this.DB.Set("IdResult", currentId, data),
                this.DB.Set("EndIdinId", currentId, upperId),
                this.DB.pushResult(upperId, data,await this.DB.Get('IndexId',currentId)),
              ]);

              let MapResult = await this.DB.getResult(upperId);
              let MapResultLength = await this.DB.getDone(upperId);
              if (
                MapResultLength == (await this.DB.Get("IdLength", upperId))
              ) {
                this.DB.Set('IdResult',upperId,MapResult)
                await this.DB.Set("IdResult", upperId, MapResult);
                this.onCompleteQueue.add([
                  await this.DB.Get("TypeId", upperId),
                   await this.DB.Get("IdinId", upperId),
                     MapResult,
                     upperId,
                     await this.DB.Get('IndexId',upperId)],{removeOnComplete:true})
               
              }
              break;
            }
            default: {

              await this.DB.Set("IdResult", currentId, data);
              this.onCompleteQueue.add([
                await this.DB.Get("TypeId", upperId),
                 await this.DB.Get("IdinId", upperId),
                   data,
                   upperId,
                   index],{removeOnComplete:true})
              
              break;
            }
          }
        } else {
          let nextObj = await this.nextDetection(currentId);
          await this.DB.Set('IdResult',currentId,data)
        
          this.startQueue.add([
           
              data,
              nextObj[0],
              nextObj[0].Type,
              upperId,
              nextObj[1],
              index
            
          ])
        }
      }
      // }

      // if next
    } catch (e) {
      console.log(type, upperId, currentId, data, e);
    }
  }

  async endDetection(Id: string) {
    let jsonData = t(this.workflow, await this.DB.Get("PosId", Id)).safeObject;
    return _.has(jsonData, "End");
  }
  async nextDetection(Id: string) {
    let tt = await this.DB.Get("PosId", Id);
    let currentJsonData = t(this.workflow, tt).safeObject;
    let currnetPosPathArr = tt.split(".");
    let perPosPath = tt.replace(
      currnetPosPathArr[currnetPosPathArr.length - 1],
      currentJsonData.Next
    );

    return [t(this.workflow, perPosPath).safeObject, perPosPath];
  }
}
