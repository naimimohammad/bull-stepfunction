let typeId: any = {};
let posId: any = {};
let IdinId: any = {};
let EndIdinId: any = {};
let IdLength: any = {};
let IdResult: any = {};
 

const setTypeId = (Id:string,Type:string) => {
typeId[Id]=Type
}

const setPosId = (Id:string,Pos:string) => {
    posId[Id]=Pos
}
const setIdinId = (Id:string,upperId:string) => {
    IdinId[Id]=upperId
}
const setEndIdinId = (Id:string,upperId:string) => {
    EndIdinId[Id]=upperId
}
const setIdLength = (Id:string,length:number) => {
    IdLength[Id]=length
}
const setIdResult = (Id:string,value:any) => {
    IdResult[Id]=value
}

const pushToResult =(Id:string,value:any)=>{
    IdResult[Id].push(value)
}
////////////////////////////////
const getTypeId = (Id:string) => {
    return typeId[Id]
}

const getPosId = (Id:string) => {
    return posId[Id]
}
const getIdinId = (Id:string) => {
    return IdinId[Id]
}
const getEndIdinId = (Id:string) => {
    return EndIdinId[Id]
}
const getIdLength = (Id:string) => {
    return IdLength[Id]
}
const getIdResult = (Id:string) => {
    return IdResult[Id]
}

const getAllEndID =()=>{
    return EndIdinId
}

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
}
export default V