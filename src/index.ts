import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import t from "typy";
import _ from "lodash";
import jp from "jsonpath";
import {Choice} from 'aws-sf-choice'

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
  constructor(jsonPath: string, resources: any) {
    this.jsonPath = jsonPath;
    this.resources = resources;

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
  init(data: any) {
    let workflowId = uuidv4();
    this.workflow[workflowId] = this.jsonPath;
    this.typeId[workflowId] = "root";
    this.posId[workflowId] = "States";
    // DB.setWorkflowToID(this.jsonPath,workflowId) // location of json to workflowId
    // DB.setTypeOfworkflow(workflowId,"root") // set this workflow as root pos
    // DB.setPositionInworkflow(workflowId,`States.${this.workflow.StartAt}`) // set position of this workflow
    let type = this.workflow.States[this.workflow.StartAt].Type;
    let jsonData = t(
      this.workflow,
      `States.${this.workflow.StartAt}`
    ).safeObject;
    this.start(
      data,
      jsonData,
      type,
      workflowId,
      `States.${this.workflow.StartAt}`
    );
  }
  start = async (
    data: any,
    jsonData: any,
    type: string,
    upperId: string,
    posPath: string
  ) => {
    switch (type) {
      case "Map": {
        let workflowId: string = uuidv4();
        this.typeId[workflowId] = type;
        this.IdinId[workflowId] = upperId;
        this.posId[workflowId] = posPath;
        let ItemsPath = jsonData.ItemsPath;
        let MapData = jp.query(data, ItemsPath)[0];
        console.log("Map Data", MapData);
        this.IdLength[workflowId] = MapData.length;
        MapData.forEach((datain: any, index: number) => {
          let nposPath = `${posPath}.Iterator.States.${jsonData.Iterator.StartAt}`;
          let ntype = t(this.workflow, nposPath).safeObject.Type;
          console.log(nposPath, ntype, "%%%%%%%");
          this.start(
            datain,
            t(this.workflow, nposPath).safeObject,
            ntype,
            workflowId,
            nposPath
          );
        });
        break
      }
      case "Parallel": {
        let workflowId: string = uuidv4();
        this.typeId[workflowId] = type;
        this.IdinId[workflowId] = upperId;
        this.posId[workflowId] = posPath;
        console.log("WWWWW", jsonData, posPath,workflowId,type);
        this.IdLength[workflowId] = jsonData.Branches.length;
        jsonData.Branches.forEach((States: any, index: number) => {
          let njsonData = States;
          let nposPath = `${posPath}.Branches[${index}].States.${njsonData.StartAt}`;
          let ntype = t(this.workflow, nposPath).safeObject.Type;
          console.log("!!!", nposPath, t(this.workflow, nposPath).safeObject);
          this.start(
            data,
            t(this.workflow, nposPath).safeObject,
            ntype,
            workflowId,
            nposPath
          );
        });
        break;
      }
      case "Task": {
        let workflowId: string = uuidv4();
        this.typeId[workflowId] = type;
        this.IdinId[workflowId] = upperId;
        this.posId[workflowId] = posPath;
        // DB.setTypeOfworkflow(workflowId,type)
        // DB.setWorkflowInWorkflow(workflowId,upperId)
        /*
                    input filter data here 
                */
        this.resources[jsonData.resources].add(data, { jobId: workflowId });
        break;
      }
      case "Wait": {
        let workflowId: string = uuidv4();
        this.typeId[workflowId] = type;
        this.IdinId[workflowId] = upperId;
        this.posId[workflowId] = posPath;
        await this.sleep(jsonData.Seconds);
        this.onCompleteState(type, upperId, data, workflowId);
        break;
      }
      case "Pass": {
        let workflowId: string = uuidv4();
        this.typeId[workflowId] = type;
        this.IdinId[workflowId] = upperId;
        this.posId[workflowId] = posPath;
        this.onCompleteState(type, upperId, data, workflowId);
        break;
      }
      case "Choice":{
        let choice = new Choice(jsonData,data)
        let next:any = await choice.start()
        let currentPosPathArr = posPath.split('.')
        let nextpospath = posPath.replace(currentPosPathArr[currentPosPathArr.length-1],next) 
        this.start(data,t(this.workflow,nextpospath).safeObject,t(this.workflow,nextpospath).safeObject.Type,upperId,nextpospath)
        break
      }

    }
  };

  jobComplete(job: any) {
    this.onCompleteState(
      "Task",
      this.IdinId[job.opts.jobId],
      job.data,
      job.opts.jobId
    );
  }
  private sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms * 1000);
    });
  }
  resultTracker(id: string) {}

  onCompleteState(type: string, upperId: string, data: any, currentId: string) {
    if (this.typeId[currentId] == "root") {
      console.log("workflow finished");
      console.log(
        "type:",
        this.typeId,
        "positon:",
        this.posId,
        "IdinId:",
        this.IdinId,
        "length:",
        this.IdLength,
        "Result:",
        this.IdResult
      );
    } else {
      if (this.endDetection(currentId)) {
        switch (this.typeId[upperId]) {
          case "Parallel": {
            console.log(this.posId[currentId]);
            this.IdResult[currentId] = data;
            this.EndIdinId[currentId] = upperId;
            let ParallelResult = this.getObjKey(this.EndIdinId, upperId);
            console.log("SSSS", ParallelResult);
            if (ParallelResult.length == this.IdLength[upperId]) {
              ParallelResult = ParallelResult.map(
                (item: any) => this.IdResult[item]
              );
              this.IdResult[upperId] = ParallelResult;
              this.onCompleteState(
                this.typeId[upperId],
                this.IdinId[upperId],
                ParallelResult,
                upperId
              );
            }
            break;
          }
          case "Map": {
            this.IdResult[currentId] = data;
            this.EndIdinId[currentId] = upperId;
            let MapResult = this.getObjKey(this.EndIdinId, upperId);
            console.log("FFFFFFF", currentId, upperId);
            if (MapResult.length == this.IdLength[upperId]) {
              MapResult = MapResult.map((item: any) => this.IdResult[item]);
              this.IdResult[upperId] = MapResult;
              this.onCompleteState(
                this.typeId[upperId],
                this.IdinId[upperId],
                MapResult,
                upperId
              );
            }
            break;
          }
          default: {
            this.IdResult[currentId] = data;
            this.onCompleteState(
              this.typeId[upperId],
              this.IdinId[upperId],
              data,
              upperId
            );
            break;
          }
        }
      } else {
        let nextObj = this.nextDetection(currentId);

        this.start(data, nextObj[0], nextObj[0].Type, upperId, nextObj[1]);
      }
    }
    // }

    // if next
  }

  endDetection(Id: string) {
    let jsonData = t(this.workflow, this.posId[Id]).safeObject;
    return _.has(jsonData, "End");
  }
  nextDetection(Id: string) {
    let currentJsonData = t(this.workflow, this.posId[Id]).safeObject;
    let currnetPosPathArr = this.posId[Id].split(".");
    let perPosPath = this.posId[Id].replace(
      currnetPosPathArr[currnetPosPathArr.length - 1],
      currentJsonData.Next
    );

    return [t(this.workflow, perPosPath).safeObject, perPosPath];
  }
}
