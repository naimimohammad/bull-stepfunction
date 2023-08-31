const axios = require('axios')
module.exports = async(job,done) =>{
    console.log("job start with data of :",job.data)
    const result =  await axios.get(`https://3l88z.wiremockapi.cloud/json/${job.data.key}`)
    job.data.result = {
        key:job.data.key,
        value: result.data.value
    }
    done()
 }