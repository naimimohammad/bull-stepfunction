import * as redis from 'redis'
export class redisCon {
    /*
    */
    client
    constructor(redisUri:string){
        this.client = redis.createClient({url: redisUri})
            this.connect()
    }
    
    async connect() {
         await this.client.connect()
    }
    public async flushAll() {
        this.client.FLUSHALL()
        .then(r=>{
            this.client.set('failedNum',0)
            this.client.set('successNum',0)
            console.log('redis has been flushed')
        })
        .catch(e=>{
            console.log('redis flushed has problem')
        })
    }

    
    public async addFailed () {
        this.client.incr('failedNum')

    }
    public async getFailed () {
        return await this.client.get('failedNum')
    }
    public async addSuccess () {
        this.client.incr('successNum')
        
    }
    public async getSuccess () {
       
        return await this.client.get('successNum')
    }
    public async getTotal () {
        return await this.client.get('totalNum')
    }
}