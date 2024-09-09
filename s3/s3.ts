import AWS from 'aws-sdk'

export async function uploadToS3(data: Buffer, filename: string) {
  const s3 = new AWS.S3()

  const params: AWS.S3.PutObjectRequest = {
    ACL: 'public-read',
    Bucket: process.env.S3_BUCKET_NAME as string,
    ContentType: 'application/pdf',
    Key: filename,
    Body: data
  }

  try {
    const resp = await s3.upload(params).promise()
    return resp.Location
  } catch (err) {
    console.error(err)
    throw new Error(err)
  }
}
