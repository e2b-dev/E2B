import {
  Body,
  Controller,
  Path,
  Post,
  Route,
} from 'tsoa'
import {
  ProcessManager,
  createSessionProcess,
  OutStderrResponse,
  OutStdoutResponse,
} from '@devbookhq/sdk'

import { retrieveSession } from './sessions'

interface RunProcessParams extends Pick<Parameters<ProcessManager['start']>[0], 'cmd' | 'envVars' | 'rootdir'> {

}

interface RunProcessResponse {
  stderr: OutStderrResponse[]
  stdout: OutStdoutResponse[]
}

@Route('sessions')
export class ProcessController extends Controller {
  @Post('{id}/process')
  public async runProcess(
    @Path() id: string,
    @Body() requestBody: RunProcessParams,
  ): Promise<RunProcessResponse> {
    const session = retrieveSession(id)

    const stderr: OutStderrResponse[] = []
    const stdout: OutStdoutResponse[] = []

    const process = await createSessionProcess({
      manager: session.process!,
      ...requestBody,
      onStderr: (o) => stderr.push(o),
      onStdout: (o) => stdout.push(o),
    })

    await process.exited
    return {
      stdout,
      stderr,
    }
  }
}
