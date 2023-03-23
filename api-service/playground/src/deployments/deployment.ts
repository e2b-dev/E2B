import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  CreateFunctionUrlConfigCommand,
  waitUntilFunctionUpdatedV2,
  AddPermissionCommand,
  GetFunctionCommand,
  GetFunctionUrlConfigCommand,
} from '@aws-sdk/client-lambda'
// import { APIGatewayClient } from '@aws-sdk/client-api-gateway'
import { EnvVars, Session } from '@devbookhq/sdk'
import * as dotenv from 'dotenv'

import { packageFunction } from './packaging'

dotenv.config({
  path: '../../.env',
})

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
}

if (!credentials.accessKeyId || !credentials.secretAccessKey) {
  throw new Error('AWS credentials not found')
}

const region = 'us-east-1'
const architecture = 'arm64'

// TODO: lambda.destroy() on quit?
const lambda = new LambdaClient({
  region,
  credentials,
})

// TODO: gateway.destroy() on quit?
// const gateway = new APIGatewayClient({
//   region,
//   credentials,
// })

const deploymentParams = {
  Runtime: 'nodejs18.x',
  Role: 'arn:aws:iam::458837768593:role/service-role/ai-api-deploy',
  Handler: 'index.handler',
}

async function waitForUpdate(projectID: string) {
  await waitUntilFunctionUpdatedV2(
    {
      client: lambda,
      maxWaitTime: 30,
    },
    {
      FunctionName: projectID,
    }
  )
}

async function getIsFunctionDeployed(projectID: string) {
  try {
    await lambda.send(
      new GetFunctionCommand(
        { FunctionName: projectID }
      )
    )
    return true
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      return false
    }
    throw err
  }
}

async function getFunctionURL(projectID: string) {
  try {
    const func = await lambda.send(
      new GetFunctionUrlConfigCommand(
        { FunctionName: projectID }
      )
    )
    return func.FunctionUrl
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      return undefined
    }
    throw err
  }
}

export async function createDeploymentInSession(
  session: Session,
  projectID: string,
  envVars?: EnvVars
) {
  // Start packaging function in session
  const zipping = packageFunction(session)
  // TODO: Can we skip getting url?
  const gettingURL = getFunctionURL(projectID)
  const isFunctionDeployed = await getIsFunctionDeployed(projectID)

  // Deploy function
  if (!isFunctionDeployed) {
    const zip = await zipping
    await lambda
      .send(
        new CreateFunctionCommand({
          ...deploymentParams,
          FunctionName: projectID,
          Code: {
            ZipFile: zip,
          },
          Environment: {
            Variables: envVars,
          },
          Architectures: [architecture],
        })
      )
    await waitForUpdate(projectID)

    // TODO: Can we paralellize url setup or predeploy the function when user creates the project?
    const urlResult = await lambda
      .send(
        new CreateFunctionUrlConfigCommand({
          FunctionName: projectID,
          AuthType: 'NONE',
          Cors: {},
        })
      )
    await waitForUpdate(projectID)

    await lambda
      .send(
        new AddPermissionCommand({
          Action: 'lambda:InvokeFunctionUrl',
          FunctionName: projectID,
          Principal: '*',
          StatementId: `${projectID}-url-permission`,
          FunctionUrlAuthType: 'NONE',
        })
      )
    await waitForUpdate(projectID)

    // TODO: Configure the Gateway to handle custom domain wildcards
    return urlResult.FunctionUrl
  }

  // Update function
  if (envVars) {
    // TODO: Can we paralellize env + code update?
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        ...deploymentParams,
        FunctionName: projectID,
        Environment: {
          Variables: envVars,
        },
      })
    )
    await waitForUpdate(projectID)
  }

  const zip = await zipping

  await lambda.send(
    new UpdateFunctionCodeCommand({
      FunctionName: projectID,
      ZipFile: zip,
      Architectures: [architecture],
    })
  )
  await waitForUpdate(projectID)

  return await gettingURL
}
