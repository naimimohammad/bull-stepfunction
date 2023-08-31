module.exports = async(job,done) =>{
    job.data=job.data.filter((item)=>item.result.value>30)
    done()
 }