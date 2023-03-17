import Lambda from 'aws-sdk/clients/lambda'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { NodeBundlerType, zipFunction } from '@netlify/zip-it-and-ship-it'
import { EnvVars } from '@devbookhq/sdk'


const tmpdir = os.tmpdir()
const prefix = `deploy-aws-`

const templateDir = '/template/aws'

const lambda = new Lambda()

// TODO: Do the zipping inside session (reusing the playground + esbuild would make it seamless) and upload to S3. Then deploy from zip artifact.
async function getZippedCode(code: string, packageJSON: string): string {
  const functionDir = await fs.mkdtemp(path.join(tmpdir, prefix))
  const zipDir = await fs.mkdtemp(path.join(tmpdir, prefix))

  // Create dirs


  // Copy from template

  // Modify index.js
  // Install deps --no-save
  // Zip and build it
  const res = await zipFunction(functionDir, zipDir, {
    config: {
      '*': {
        nodeBundler: NodeBundlerType.ESBUILD_ZISI,
      },
    },
  })

  // Remove tmp files
}


export async function deploy(projectID: string, code: string, packageJSON: string, envVars: EnvVars) {
  const zipContent = getZippedCode(code, packageJSON)

  // Deploy on aws + handle env vars
  const func = await lambda.createFunction({
    FunctionName: `${projectID}`,
    Runtime: 'nodejs18.x',
    // TODO: Replace lambda role with valid role
    Role: 'arn:aws:iam::123456789012:role/lambda-role',
    Handler: 'index.handler',
    Code: {
      ZipFile: Buffer.from(zipContent, 'base64')
    },
    Environment: envVars,
  }).promise()

  // TODO: Add lambda deploy URL
  // Reconfigure the Gateway to handle domains

}
