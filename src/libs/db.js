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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBCon = void 0;
const redis = __importStar(require("redis"));
class DBCon {
    constructor(redisUri) {
        this.client = redis.createClient({ url: redisUri });
        this.publisher = redis.createClient({ url: redisUri });
        this.subscriber = redis.createClient({ url: redisUri });
        this.connect();
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([this.client.connect(), this.publisher.connect(), this.subscriber.connect()]);
        });
    }
    Set(type, Id, value) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (typeof value) {
                case 'number':
                    value = `#number:${value.toString()}`;
                    break;
                case 'object':
                    // if (Array.isArray(value)){
                    //     console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
                    //     value = `#array:${value.toString()}`
                    //     break
                    // }
                    // else {
                    value = `#object:${JSON.stringify(value)}`;
                    break;
                // }
                case 'undefined':
                    value = "";
                    break;
                case 'boolean':
                    value = `#boolean:${value.toString()}`;
                    break;
                case 'string':
                    break;
            }
            return yield this.client.set(`${type}:${Id}`, value);
        });
    }
    Get(type, Id) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = yield this.client.get(`${type}:${Id}`);
            return this.checkObj(result);
        });
    }
    pushResult(Id, value, index) {
        return __awaiter(this, void 0, void 0, function* () {
            let fvalue = value;
            switch (typeof value) {
                case 'number':
                    value = `#number:${value.toString()}`;
                    break;
                case 'object':
                    // if (Array.isArray(value)){
                    //     console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
                    //     value = `#array:${value.toString()}`
                    //     break
                    // }
                    // else {
                    value = `#object:${JSON.stringify(value)}`;
                    break;
                // }
                case 'undefined':
                    value = "";
                    break;
                case 'boolean':
                    value = `#boolean:${value.toString()}`;
                    break;
                case 'string':
                    break;
            }
            yield Promise.all([
                // this.client.lSet(`Result:${Id}`,index,(typeof value === 'object')?JSON.stringify(value):value),
                this.client.LSET(`Result:${Id}`, index, value),
                this.client.incr(`Done:${Id}`)
            ]).catch(e => {
                console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", value, fvalue, e, Id, index);
            });
        });
    }
    createList(Id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.client;
        });
    }
    CreateInitResult(Id, length) {
        return __awaiter(this, void 0, void 0, function* () {
            let arr = [];
            for (let index = 0; index < length; index++) {
                arr.push("");
            }
            // this.client.set(`Result:${Id}`,0)
            yield this.client.lPush(`Result:${Id}`, arr);
        });
    }
    getResult(Id) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = yield this.client.lRange(`Result:${Id}`, 0, -1);
            result = result.map((item) => this.checkObj(item));
            return result;
        });
    }
    getDone(Id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.client.get(`Done:${Id}`);
        });
    }
    checkObj(value) {
        if (value) {
            if (value.includes('#number:')) {
                return parseInt(value.split('#number:')[1]);
            }
            else if (value.includes('#object:')) {
                return JSON.parse(value.split('#object:')[1]);
            }
            else if (value == "") {
                return undefined;
            }
            else if (value.includes('#array:')) {
                return value.split('#array:')[1].split(',');
            }
            else if (value.includes('#boolean:')) {
                return (value == '#boolean:true') ? true : false;
            }
            else
                return value;
        }
        else
            return value;
    }
}
exports.DBCon = DBCon;
