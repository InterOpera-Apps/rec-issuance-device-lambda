# rec-issuance-invoice-lambda

Deploy lambda into AWS using serverless framework

## Installation
```
sudo npm install serverless --location=global 
```

## Deployment

- Edit `serverless.yaml` as you need
    - Refer to [AWS Lambda](https://www.serverless.com/framework/docs/providers/aws/guide/functions)
    - You may need to configure VPC, subnets... for the lambda function
- Open a shell terminal & paste your AWS credentials
- Run below command to deploy
    ```
    serverless deploy
    ```
- Login AWS console, go to `Lambda` service under `Singapore` region, you'll find the deploy function