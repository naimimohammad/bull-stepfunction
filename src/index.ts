import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import t from "typy";
import _ from "lodash";
import jp from "jsonpath";
import { Choice } from "aws-sf-choice";
import V from "./libs/newdb";
import { DBCon } from "./libs/db";
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
  constructor(jsonPath: string, resources: any) {
    this.DB = new DBCon("redis://127.0.0.1:6381");
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
  async init(data: any) {
    let workflowId = uuidv4();
    this.workflow[workflowId] = this.jsonPath;

    await Promise.all([
      this.DB.Set("TypeId", workflowId, "root"),
      this.DB.Set("PosId", workflowId, "States"),
    ]);

  
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
          this.DB.CreateInitResult(workflowId, MapData.length),
        ]);

        for (let [index, datain] of MapData.entries()) {
          let nposPath = `${posPath}.Iterator.States.${jsonData.Iterator.StartAt}`;
          let ntype = t(this.workflow, nposPath).safeObject.Type;
          console.log(nposPath, ntype, "%%%%%%%");
           await this.start(
            datain,
            t(this.workflow, nposPath).safeObject,
            ntype,
            workflowId,
            nposPath,
            index
          );
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

          this.DB.CreateInitResult(workflowId, jsonData.Branches.length),
        ]);

        console.log("WWWWW", jsonData, posPath, workflowId, type);

        for (let [index, States] of jsonData.Branches.entries()) {
          let njsonData = States;
          let nposPath = `${posPath}.Branches[${index}].States.${njsonData.StartAt}`;
          let ntype = t(this.workflow, nposPath).safeObject.Type;
          console.log("!!!", nposPath, t(this.workflow, nposPath).safeObject);
          await this.start(
            data,
            t(this.workflow, nposPath).safeObject,
            ntype,
            workflowId,
            nposPath,index
          );
        }
        break;
      }
      case "Task": {
        let workflowId: string = uuidv4();

        await Promise.all([
          this.DB.Set("TypeId", workflowId, type),
          this.DB.Set("IdinId", workflowId, upperId),
          this.DB.Set("PosId", workflowId, posPath),
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
        ]);

        await this.sleep(jsonData.Seconds);
        await this.onCompleteState(type, upperId, data, workflowId,index);
        break;
      }
      case "Pass": {
        let workflowId: string = uuidv4();
        console.log("SSSSSSSSSSSSSSDDDDDDDD",index)
        await Promise.all([
          this.DB.Set("TypeId", workflowId, type),
          this.DB.Set("IdinId", workflowId, upperId),
          this.DB.Set("PosId", workflowId, posPath),
        ]);

        V.setTypeId(workflowId, type);
        V.setIdinId(workflowId, upperId);
        V.setPosId(workflowId, posPath);

        await this.onCompleteState(type, upperId, data, workflowId,index);
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
        this.start(
          data,
          t(this.workflow, nextpospath).safeObject,
          t(this.workflow, nextpospath).safeObject.Type,
          upperId,
          nextpospath,
          index
        );
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
        console.log("workflow finished");
        // console.log(
        //   "type:",
        //   this.typeId,
        //   "positon:",
        //   this.posId,
        //   "IdinId:",
        //   this.IdinId,
        //   "length:",
        //   this.IdLength,
        //   "Result:",
        //   this.IdResult
        // );
      } else {
        if (await this.endDetection(currentId)) {
          // switch (V.getTypeId(upperId)) {
          switch (await this.DB.Get("TypeId", upperId)) {
            case "Parallel": {
              await Promise.all([
                this.DB.Set("IdResult", currentId, data),
                this.DB.Set("EndIdinId", currentId, upperId),
                this.DB.pushResult(upperId, data,index),
              ]);

              let ParallelResult = await this.DB.getResult(upperId);
              let ParallelResultLength = await this.DB.getDone(upperId);
              console.log("DDDDDDD",ParallelResult,ParallelResultLength,await this.DB.Get("IdLength", upperId))
              if (
                ParallelResultLength == (await this.DB.Get("IdLength", upperId))
              ) {
                console.log("SSSS", ParallelResultLength);

                await this.DB.Set("IdResult", upperId, ParallelResult);
                this.onCompleteState(
                  await this.DB.Get("TypeId", upperId),
                  await this.DB.Get("IdinId", upperId),
                  ParallelResult,
                  upperId,
                  index
                );
              }
              break;
            }
            case "Map": {
              await Promise.all([
                this.DB.Set("IdResult", currentId, data),
                this.DB.Set("EndIdinId", currentId, upperId),
                this.DB.pushResult(upperId, data,index),
              ]);

              let MapResult = await this.DB.getResult(upperId);
              let MapResultLength = await this.DB.getDone(upperId);
              console.log("FFFFFFF", currentId, upperId, MapResult,index);
              if (
                MapResultLength == (await this.DB.Get("IdLength", upperId))
              ) {
                console.log("Map Done!", MapResult.length);
                this.DB.Set('IdResult',upperId,MapResult)
                // V.setIdResult(upperId, MapResult);
                await this.DB.Set("IdResult", upperId, MapResult);
                await this.onCompleteState(
                  await this.DB.Get("TypeId", upperId),
                  await this.DB.Get("IdinId", upperId),
                  MapResult,
                  upperId
                );
              }
              break;
            }
            default: {
              V.setIdResult(currentId, data);
              await this.DB.Set("IdResult", currentId, data);
              await this.onCompleteState(
                await this.DB.Get("TypeId", upperId),
                await this.DB.Get("IdinId", upperId),
                data,
                upperId
              );
              break;
            }
          }
        } else {
          let nextObj = await this.nextDetection(currentId);

          await this.start(
            data,
            nextObj[0],
            nextObj[0].Type,
            upperId,
            nextObj[1],
            index
          );
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
