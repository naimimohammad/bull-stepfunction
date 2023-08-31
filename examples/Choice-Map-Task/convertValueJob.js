module.exports = async(job,done) =>{
    console.log(job.data)
    job.data.result.value = parseInt(job.data.result.value)
    done()
 }