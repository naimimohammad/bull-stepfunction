"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepFunction = void 0;
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const typy_1 = __importDefault(require("typy"));
const lodash_1 = __importDefault(require("lodash"));
const jsonpath_1 = __importDefault(require("jsonpath"));
const aws_sf_choice_1 = require("aws-sf-choice");
const db_1 = require("./libs/db");
const bull_1 = __importDefault(require("bull"));
const events_1 = require("events");
class StepFunction extends events_1.EventEmitter {
    constructor(jsonPath, resources, redis) {
        super();
        this.typeId = {};
        this.posId = {};
        this.IdinId = {};
        this.EndIdinId = {};
        this.IdLength = {};
        this.IdResult = {};
        this.DB = {};
        this.DB = new db_1.DBCon(redis);
        this.jsonPath = jsonPath;
        this.resources = resources;
        this.onCompleteQueue = new bull_1.default('onCompleteState', redis);
        this.startQueue = new bull_1.default('startQueue', redis);
        this.startQueue.process(100, (job, done) => {
            let data = Object.assign({}, job.data);
            console.log(`${data[2]} at position ${data[4]} started`);
            this.start(data[0], data[1], data[2], data[3], data[4], data[5]);
            done();
        });
        this.onCompleteQueue.process(1, (job, done) => __awaiter(this, void 0, void 0, function* () {
            let data = Object.assign({}, job.data);
            console.log(`${data[0]} at position ${yield this.DB.Get('PosId', data[3])} finished`);
            yield this.onCompleteState(data[0], data[1], data[2], data[3], data[4]);
            done();
        }));
        this.workflow = JSON.parse(
        // fs.readFileSync(path.join(__dirname, jsonPath), {
        fs.readFileSync(jsonPath, {
            encoding: "utf-8",
        }));
    }
    init(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let workflowId = (0, uuid_1.v4)();
            yield this.DB.Set('workflow', workflowId, this.jsonPath);
            yield Promise.all([
                this.DB.Set("TypeId", workflowId, "root"),
                this.DB.Set("PosId", workflowId, "States"),
            ]);
            let type = this.workflow.States[this.workflow.StartAt].Type;
            let jsonData = (0, typy_1.default)(this.workflow, `States.${this.workflow.StartAt}`).safeObject;
            this.startQueue.add([
                data,
                jsonData,
                type,
                workflowId,
                `States.${this.workflow.StartAt}`
            ]);
        });
    }
    start(data, jsonData, type, upperId, posPath, index) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (type) {
                case "Map": {
                    let workflowId = (0, uuid_1.v4)();
                    let ItemsPath = jsonData.ItemsPath;
                    let MapData = jsonpath_1.default.query(data, ItemsPath)[0];
                    yield Promise.all([
                        this.DB.Set("TypeId", workflowId, type),
                        this.DB.Set("IdinId", workflowId, upperId),
                        this.DB.Set("PosId", workflowId, posPath),
                        this.DB.Set("IdLength", workflowId, MapData.length),
                        this.DB.Set('IndexId', workflowId, index),
                        this.DB.CreateInitResult(workflowId, MapData.length),
                    ]);
                    for (let [index, datain] of MapData.entries()) {
                        let nposPath = `${posPath}.Iterator.States.${jsonData.Iterator.StartAt}`;
                        let ntype = (0, typy_1.default)(this.workflow, nposPath).safeObject.Type;
                        this.startQueue.add([
                            datain,
                            (0, typy_1.default)(this.workflow, nposPath).safeObject,
                            ntype,
                            workflowId,
                            nposPath,
                            index
                        ]);
                    }
                    break;
                }
                case "Parallel": {
                    let workflowId = (0, uuid_1.v4)();
                    yield Promise.all([
                        this.DB.Set("TypeId", workflowId, type),
                        this.DB.Set("IdinId", workflowId, upperId),
                        this.DB.Set("PosId", workflowId, posPath),
                        this.DB.Set("IdLength", workflowId, jsonData.Branches.length),
                        this.DB.Set('IndexId', workflowId, index),
                        this.DB.CreateInitResult(workflowId, jsonData.Branches.length),
                    ]);
                    for (let [index, States] of jsonData.Branches.entries()) {
                        let njsonData = States;
                        let nposPath = `${posPath}.Branches[${index}].States.${njsonData.StartAt}`;
                        let ntype = (0, typy_1.default)(this.workflow, nposPath).safeObject.Type;
                        this.startQueue.add([
                            data,
                            (0, typy_1.default)(this.workflow, nposPath).safeObject,
                            ntype,
                            workflowId,
                            nposPath,
                            index
                        ]);
                    }
                    break;
                }
                case "Task": {
                    let workflowId = (0, uuid_1.v4)();
                    yield Promise.all([
                        this.DB.Set("TypeId", workflowId, type),
                        this.DB.Set("IdinId", workflowId, upperId),
                        this.DB.Set("PosId", workflowId, posPath),
                        this.DB.Set('IndexId', workflowId, index),
                    ]);
                    this.resources[jsonData.resources].add(data, { jobId: workflowId });
                    break;
                }
                case "Wait": {
                    let workflowId = (0, uuid_1.v4)();
                    yield Promise.all([
                        this.DB.Set("TypeId", workflowId, type),
                        this.DB.Set("IdinId", workflowId, upperId),
                        this.DB.Set("PosId", workflowId, posPath),
                        this.DB.Set('IndexId', workflowId, index),
                    ]);
                    yield this.sleep(jsonData.Seconds);
                    this.onCompleteQueue.add([type, upperId, data, workflowId, index], { removeOnComplete: true });
                    break;
                }
                case "Pass": {
                    let workflowId = (0, uuid_1.v4)();
                    yield Promise.all([
                        this.DB.Set("TypeId", workflowId, type),
                        this.DB.Set("IdinId", workflowId, upperId),
                        this.DB.Set("PosId", workflowId, posPath),
                        this.DB.Set('IndexId', workflowId, index),
                    ]);
                    this.onCompleteQueue.add([type, upperId, data, workflowId, index], { removeOnComplete: true });
                    break;
                }
                case "Choice": {
                    let choice = new aws_sf_choice_1.Choice(jsonData, data);
                    let next = yield choice.start();
                    let currentPosPathArr = posPath.split(".");
                    let nextpospath = posPath.replace(currentPosPathArr[currentPosPathArr.length - 1], next);
                    this.startQueue.add([
                        data,
                        (0, typy_1.default)(this.workflow, nextpospath).safeObject,
                        (0, typy_1.default)(this.workflow, nextpospath).safeObject.Type,
                        upperId,
                        nextpospath,
                        index
                    ]);
                    break;
                }
            }
        });
    }
    jobComplete(job) {
        return __awaiter(this, void 0, void 0, function* () {
            this.onCompleteState("Task", yield this.DB.Get("IdinId", job.opts.jobId), job.data, job.opts.jobId);
        });
    }
    sleep(s) {
        return new Promise((resolve) => {
            setTimeout(resolve, s * 1000);
        });
    }
    resultTracker(id) { }
    onCompleteState(type, upperId, data, currentId, index) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if ((yield this.DB.Get("TypeId", currentId)) == "root") {
                    yield this.DB.Set('IdResult', currentId, data);
                    console.log("workflow finished", yield this.DB.Get('IdResult', currentId));
                    this.emit('complete', { workflowId: currentId, data: data });
                }
                else {
                    if (yield this.endDetection(currentId)) {
                        switch (yield this.DB.Get("TypeId", upperId)) {
                            case "Parallel": {
                                yield Promise.all([
                                    this.DB.Set("IdResult", currentId, data),
                                    this.DB.Set("EndIdinId", currentId, upperId),
                                    this.DB.pushResult(upperId, data, yield this.DB.Get('IndexId', currentId)),
                                ]);
                                let ParallelResult = yield this.DB.getResult(upperId);
                                let ParallelResultLength = yield this.DB.getDone(upperId);
                                if (ParallelResultLength == (yield this.DB.Get("IdLength", upperId))) {
                                    yield this.DB.Set("IdResult", upperId, ParallelResult);
                                    this.onCompleteQueue.add([
                                        yield this.DB.Get("TypeId", upperId),
                                        yield this.DB.Get("IdinId", upperId),
                                        ParallelResult,
                                        upperId,
                                        yield this.DB.Get('IndexId', upperId)
                                    ], { removeOnComplete: true });
                                }
                                break;
                            }
                            case "Map": {
                                yield Promise.all([
                                    this.DB.Set("IdResult", currentId, data),
                                    this.DB.Set("EndIdinId", currentId, upperId),
                                    this.DB.pushResult(upperId, data, yield this.DB.Get('IndexId', currentId)),
                                ]);
                                let MapResult = yield this.DB.getResult(upperId);
                                let MapResultLength = yield this.DB.getDone(upperId);
                                if (MapResultLength == (yield this.DB.Get("IdLength", upperId))) {
                                    this.DB.Set('IdResult', upperId, MapResult);
                                    yield this.DB.Set("IdResult", upperId, MapResult);
                                    this.onCompleteQueue.add([
                                        yield this.DB.Get("TypeId", upperId),
                                        yield this.DB.Get("IdinId", upperId),
                                        MapResult,
                                        upperId,
                                        yield this.DB.Get('IndexId', upperId)
                                    ], { removeOnComplete: true });
                                }
                                break;
                            }
                            default: {
                                yield this.DB.Set("IdResult", currentId, data);
                                this.onCompleteQueue.add([
                                    yield this.DB.Get("TypeId", upperId),
                                    yield this.DB.Get("IdinId", upperId),
                                    data,
                                    upperId,
                                    index
                                ], { removeOnComplete: true });
                                break;
                            }
                        }
                    }
                    else {
                        let nextObj = yield this.nextDetection(currentId);
                        yield this.DB.Set('IdResult', currentId, data);
                        this.startQueue.add([
                            data,
                            nextObj[0],
                            nextObj[0].Type,
                            upperId,
                            nextObj[1],
                            index
                        ]);
                    }
                }
                // }
                // if next
            }
            catch (e) {
                console.log(type, upperId, currentId, data, e);
            }
        });
    }
    endDetection(Id) {
        return __awaiter(this, void 0, void 0, function* () {
            let jsonData = (0, typy_1.default)(this.workflow, yield this.DB.Get("PosId", Id)).safeObject;
            return lodash_1.default.has(jsonData, "End");
        });
    }
    nextDetection(Id) {
        return __awaiter(this, void 0, void 0, function* () {
            let tt = yield this.DB.Get("PosId", Id);
            let currentJsonData = (0, typy_1.default)(this.workflow, tt).safeObject;
            let currnetPosPathArr = tt.split(".");
            let perPosPath = tt.replace(currnetPosPathArr[currnetPosPathArr.length - 1], currentJsonData.Next);
            return [(0, typy_1.default)(this.workflow, perPosPath).safeObject, perPosPath];
        });
    }
}
exports.StepFunction = StepFunction;
