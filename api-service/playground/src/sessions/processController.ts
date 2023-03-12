import {
  Body,
  Controller,
  Path,
  Get,
  Post,
  Route,
  Delete,
  Query,
} from 'tsoa'
import {
  ProcessManager,
  createSessionProcess,
  OutStderrResponse,
  OutStdoutResponse,
} from '@devbookhq/sdk'

import { retrieveEntry } from './sessions'

interface RunProcessParams extends Pick<Parameters<ProcessManager['start']>[0], 'cmd' | 'envVars' | 'rootdir'> { }

interface RunProcessResponse {
  stderr: OutStderrResponse[]
  stdout: OutStdoutResponse[]
}

@Route('sessions')
export class ProcessController extends Controller {
  @Post('{id}/process')
  public async runProcess(
    @Path() id: string,
    @Query() wait: boolean,
    @Body() requestBody: RunProcessParams,
  ): Promise<RunProcessResponse> {
    const session = retrieveEntry(id)

    const stderr: OutStderrResponse[] = []
    const stdout: OutStdoutResponse[] = []

    const process = await createSessionProcess({
      manager: session.process!,
      ...requestBody,
      onStderr: (o) => stderr.push(o),
      onStdout: (o) => stdout.push(o),
    })

    if (wait) {
      await process.exited
    }

    return {
      stdout,
      stderr,
    }
  }

  @Delete('{id}/process/{processID}')
  public async stopProcess(
    @Path() id: string,
    @Path() processID: string,
  ): Promise<RunProcessResponse> {
    const session = retrieveEntry(id)

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



  @Get('{id}/process/{pid}/output')
  public async getProcessOutput(
    @Path() id: string,
    @Path() processID: string,
  ): Promise<RunProcessResponse> {
    const session = retrieveEntry(id)




    return {
      stdout,
      stderr,
    }
  }
}
