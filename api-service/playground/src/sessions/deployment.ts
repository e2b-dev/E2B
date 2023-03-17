import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda'
import {
  APIGatewayClient,
} from '@aws-sdk/client-api-gateway'
import { EnvVars, Session, createSessionProcess } from '@devbookhq/sdk'
import { readFileAsBase64 } from '../utils/readFileAsBase64'

// TODO: Env var for aws initialization
const lambda = new LambdaClient({
  region: 'us-east-1',
})

const gateway = new APIGatewayClient({
  region: 'us-east-1',
})

const deploymentParams = {
  Runtime: 'nodejs18.x',
  // TODO: Replace lambda role with valid role
  Role: 'arn:aws:iam::123456789012:role/lambda-role',
  Handler: 'index.handler',
}

async function packageFunction(session: Session, code: string) {
  try {
    await session.filesystem?.write('/code/funcs/index.mjs', code)
    const bundling = await createSessionProcess({
      manager: session.process,
      cmd: 'zip-it-and-ship-it funcs bundle',
      rootdir: '/code',
    })
    await bundling.exited

    const zip = await readFileAsBase64(session.process!, '/code/bundle/index.zip')
    return Buffer.from(zip, 'base64')
  } catch (err) {
    console.error(err)
    throw err
  }
}

export async function deployFromSession(
  session: Session,
  projectID: string,
  code: string,
  envVars: EnvVars,
) {
  const zipCode = await packageFunction(session, code)
  try {
    const updateConfig = lambda.send(new UpdateFunctionConfigurationCommand({
      ...deploymentParams,
      FunctionName: projectID,
      Environment: envVars,
    }))

    const updateCode = lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: projectID,
      ZipFile: zipCode,
    }))

    await Promise.all([
      updateCode,
      updateConfig,
    ])

  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      await lambda.send(new CreateFunctionCommand({
        ...deploymentParams,
        FunctionName: projectID,
        Code: {
          ZipFile: zipCode,
        },
        Environment: envVars,
      }));
    }
  }

  // TODO: Add lambda deploy URL
  // TODO: Reconfigure the Gateway to handle domains
}
