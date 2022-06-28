import * as redis from 'redis'
export class DBCon {
    /*
    */
    client;
    constructor(redisUri:string){
        this.client = redis.createClient({url: redisUri})
        
            this.connect()
    }
    
    async connect() {
         await this.client.connect()
    }


    
    public async Set (type:string,Id:string,value:any) {
        switch (typeof value) {
            case 'number':
                value = `#number:${value.toString()}`
                break;
            case 'object':
                value = `#object:${JSON.stringify(value)}`
                break
        }
       return  this.client.set(`${type}:${Id}`,value)

    }
    public async Get (type:string,Id:string) {
        let result:any = await this.client.get(`${type}:${Id}`)
        // if (type == 'IdResult'){
        //     try {
        //         return JSON.parse(result)
        //     } catch (error) {
        //         return result
        //     }
        // }
        // else 
        return this.checkObj(result)
    }
    public async pushResult (Id:string,value:any,index:number) {
        let fvalue = value
        switch (typeof value) {
            case 'number':
                value = `#number:${value.toString()}`
                break;
            case 'object':
                value = `#object:${JSON.stringify(value)}`
                break
            case 'undefined':
                value = ""
                break
        }
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",typeof value)

        Promise.all([
            // this.client.lSet(`Result:${Id}`,index,(typeof value === 'object')?JSON.stringify(value):value),
            this.client.LSET(`Result:${Id}`,index,value),
            this.client.incr(`Done:${Id}`)]
        ).catch(e=>{
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",value,fvalue,e )
        })
        
    }

    public async createList(Id:string) {
        this.client
    }

    public async CreateInitResult(Id:string,length:number){
        let arr:any = []
        for (let index = 0; index < length; index++) {
            arr.push("")
            
        }
        // this.client.set(`Result:${Id}`,0)
        this.client.lPush(`Result:${Id}`,arr)
    }

    public async getResult (Id:string) {
        let result:any = await this.client.lRange(`Result:${Id}`,0,-1)
        result=result.map((item:any)=>
            this.checkObj(item)
        )
        return result
    }


    public async getDone (Id:string) {
        return await this.client.get(`Done:${Id}`)
    }
    checkObj(value:any){
        if (value){
        if(value.includes('#number:')){return parseInt(value.split('#number:')[1])}
        else if (value.includes('#object:')){return JSON.parse(value.split('#object:')[1])}
        else return value
        }
        else return value
    }
}


