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

export class StepFunction {
  workflow: any;
  workflowId!: string;
  resources: any;
  jsonPath!: string;
  typeId: any = {};
  posId: any = {};
  IdinId: any = {};
  EndIdinId: any = {};
  IdLength: any = {};
  IdResult: any = {};
  DB: any = {};
  onCompleteQueue :any
  startQueue:any;
  constructor(jsonPath: string, resources: any) {
    this.DB = new DBCon("redis://127.0.0.1:6381");
    this.jsonPath = jsonPath;
    this.resources = resources;
    this.onCompleteQueue = new Queue('onCompleteState',"redis://127.0.0.1:6381")
    this.startQueue = new Queue('startQueue',"redis://127.0.0.1:6381")
    this.startQueue.process(100,(job:any,done:any)=>{
      let data = {...job.data}
      this.start(data[0],data[1],data[2],data[3],data[4],data[5])
      done()
    })
    this.onCompleteQueue.process(1,async (job:any,done:any)=>{
      let data = {...job.data}
      await this.onCompleteState(data[0],data[1],data[2],data[3],data[4])
      done()
    })
    this.workflow = JSON.parse(
      fs.readFileSync(path.join(__dirname, jsonPath), {
        encoding: "utf-8",
      })
    );
  }

  private getObjKey(obj: any, value: any) {
    let t: any[] = [];
    Object.keys(obj).forEach((item) => {
      if (obj[item] == value) t.push(item);
    });
    return t;
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
        console.log("$$$$4",index)
        let ItemsPath = jsonData.ItemsPath;
        let MapData = jp.query(data, ItemsPath)[0];
        console.log("Map Data", MapData);

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
          console.log(nposPath, ntype, "%%%%%%%",index,datain);
          //   this.start(
          //   datain,
          //   t(this.workflow, nposPath).safeObject,
          //   ntype,
          //   workflowId,
          //   nposPath,
          //   index
          // );
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

        console.log("WWWWW", jsonData, posPath, workflowId, type);

        for (let [index, States] of jsonData.Branches.entries()) {
          console.log("!@!@!@!@!!@@:",index,States)
          let njsonData = States;
          let nposPath = `${posPath}.Branches[${index}].States.${njsonData.StartAt}`;
          let ntype = t(this.workflow, nposPath).safeObject.Type;
          console.log("!!!", nposPath, t(this.workflow, nposPath).safeObject);
          //  this.start(
          //   data,
          //   t(this.workflow, nposPath).safeObject,
          //   ntype,
          //   workflowId,
          //   nposPath,
          //   index
          // );
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
        // await this.onCompleteState(type, upperId, data, workflowId,index);
        break;
      }
      case "Pass": {
        let workflowId: string = uuidv4();
        console.log("SSSSSSSSSSSSSSDDDDDDDD",index)
        await Promise.all([
          this.DB.Set("TypeId", workflowId, type),
          this.DB.Set("IdinId", workflowId, upperId),
          this.DB.Set("PosId", workflowId, posPath),
          this.DB.Set('IndexId',workflowId,index),

        ]);

       
        this.onCompleteQueue.add([type, upperId, data, workflowId,index],{removeOnComplete:true})

        // await this.onCompleteState(type, upperId, data, workflowId,index);
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
        // this.start(
        //   data,
        //   t(this.workflow, nextpospath).safeObject,
        //   t(this.workflow, nextpospath).safeObject.Type,
        //   upperId,
        //   nextpospath,
        //   index
        // );
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
    // return Promise.resolve()
  
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
      } else {
        if (await this.endDetection(currentId)) {
          // switch (V.getTypeId(upperId)) {
          switch (await this.DB.Get("TypeId", upperId)) {
            case "Parallel": {
              await Promise.all([
                this.DB.Set("IdResult", currentId, data),
                this.DB.Set("EndIdinId", currentId, upperId),
                this.DB.pushResult(upperId, data,await this.DB.Get('IndexId',currentId)),
              ]);
              console.log(data)
              let ParallelResult = await this.DB.getResult(upperId);
              let ParallelResultLength = await this.DB.getDone(upperId);
              console.log("DDDDDDD",index,ParallelResult,ParallelResultLength,await this.DB.Get("IdLength", upperId))
              if (
                ParallelResultLength == (await this.DB.Get("IdLength", upperId))
              ) {
                console.log("SSSS", ParallelResultLength);

                await this.DB.Set("IdResult", upperId, ParallelResult);
                this.onCompleteQueue.add([
                  await this.DB.Get("TypeId", upperId),
                   await this.DB.Get("IdinId", upperId),
                     ParallelResult,
                     upperId,
                     await this.DB.Get('IndexId',upperId)],{removeOnComplete:true})

                // this.onCompleteState(
                //   await this.DB.Get("TypeId", upperId),
                //   await this.DB.Get("IdinId", upperId),
                //   ParallelResult,
                //   upperId,
                //   index
                // );
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
              console.log("FFFFFFF", currentId, upperId, MapResult,index);
              if (
                MapResultLength == (await this.DB.Get("IdLength", upperId))
              ) {
                console.log("Map Done!", MapResult.length,MapResult);
                this.DB.Set('IdResult',upperId,MapResult)
                // V.setIdResult(upperId, MapResult);
                await this.DB.Set("IdResult", upperId, MapResult);
                this.onCompleteQueue.add([
                  await this.DB.Get("TypeId", upperId),
                   await this.DB.Get("IdinId", upperId),
                     MapResult,
                     upperId,
                     await this.DB.Get('IndexId',upperId)],{removeOnComplete:true})
                // await this.onCompleteState(
                //   await this.DB.Get("TypeId", upperId),
                //   await this.DB.Get("IdinId", upperId),
                //   MapResult,
                //   upperId,
                //   index
                // );
              }
              break;
            }
            default: {
              console.log("DDSDSDSDSDSDDWDSDSDSDSSDSSDSDSDSSSDDSS",index,data)

              await this.DB.Set("IdResult", currentId, data);
              this.onCompleteQueue.add([
                await this.DB.Get("TypeId", upperId),
                 await this.DB.Get("IdinId", upperId),
                   data,
                   upperId,
                   index],{removeOnComplete:true})
              // await this.onCompleteState(
              //   await this.DB.Get("TypeId", upperId),
              //   await this.DB.Get("IdinId", upperId),
              //   data,
              //   upperId,
              //   index
              // );
              break;
            }
          }
        } else {
          let nextObj = await this.nextDetection(currentId);
          await this.DB.Set('IdResult',currentId,data)
          //  this.start(
          //   data,
          //   nextObj[0],
          //   nextObj[0].Type,
          //   upperId,
          //   nextObj[1],
          //   index
          // );
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
