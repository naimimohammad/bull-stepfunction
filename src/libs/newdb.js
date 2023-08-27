"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let typeId = {};
let posId = {};
let IdinId = {};
let EndIdinId = {};
let IdLength = {};
let IdResult = {};
const setTypeId = (Id, Type) => {
    typeId[Id] = Type;
};
const setPosId = (Id, Pos) => {
    posId[Id] = Pos;
};
const setIdinId = (Id, upperId) => {
    IdinId[Id] = upperId;
};
const setEndIdinId = (Id, upperId) => {
    EndIdinId[Id] = upperId;
};
const setIdLength = (Id, length) => {
    IdLength[Id] = length;
};
const setIdResult = (Id, value) => {
    IdResult[Id] = value;
};
const pushToResult = (Id, value) => {
    IdResult[Id].push(value);
};
////////////////////////////////
const getTypeId = (Id) => {
    return typeId[Id];
};
const getPosId = (Id) => {
    return posId[Id];
};
const getIdinId = (Id) => {
    return IdinId[Id];
};
const getEndIdinId = (Id) => {
    return EndIdinId[Id];
};
const getIdLength = (Id) => {
    return IdLength[Id];
};
const getIdResult = (Id) => {
    return IdResult[Id];
};
const getAllEndID = () => {
    return EndIdinId;
};
const V = {
    setTypeId,
    setEndIdinId,
    setIdLength,
    setIdResult,
    setIdinId,
    setPosId,
    getEndIdinId,
    getIdLength,
    getIdResult,
    getIdinId,
    getPosId,
    getTypeId,
    getAllEndID,
    pushToResult
};
exports.default = V;
