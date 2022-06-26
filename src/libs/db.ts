import * as redis from 'redis'
export class redisCon {
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
       return await this.client.set(`${type}:${Id}`,(typeof value === 'object')?JSON.stringify(value):value)

    }
    public async Get (type:string,Id:string) {
        let result:any = await this.client.get(`${type}:${Id}`)
        if (type == 'IdResult'){
            try {
                return JSON.parse(result)
            } catch (error) {
                return result
            }
        }
    }
    public async pushResult (Id:string,index:number,value:any) {
        Promise.all([this.client.lSet(`Result:${Id}`,index,(typeof value === 'object')?JSON.stringify(value):value),
            this.client.incr(`Done:${Id}`)]
        )
        
    }

    public async getResult (Id:string) {
        let result:any = await this.client.get(`Result:${Id}`)
        result=result.map((item:any)=>
            this.checkObj(item)
        )
        return result
    }


    public async getDone (Id:string) {
        return await this.client.get(`Done:${Id}`)
    }
    checkObj(value:any){
        try {
            return JSON.parse(value)
        } catch (error) {
            return value
        }
    }
}


