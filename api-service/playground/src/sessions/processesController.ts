import {
  Body,
  Controller,
  Path,
  Get,
  Post,
  Route,
  Delete,
  Query,
  BodyProp,
} from 'tsoa'
import {
  ProcessManager,
  OutStderrResponse,
  OutStdoutResponse,
} from '@devbookhq/sdk'

import { CachedSession } from './session'

interface StartProcessParams extends Pick<Parameters<ProcessManager['start']>[0], 'cmd' | 'envVars' | 'rootdir'> { }

interface ProcessResponse {
  stderr: OutStderrResponse[]
  stdout: OutStdoutResponse[]
  processID: string
  finished: boolean
}

@Route('sessions')
export class ProcessController extends Controller {
  /**
   * 
   * @param id 
   * @param wait if true the request will wait until the process ends and then return the `stdout`, `stderr` and `processID`.
   * @param requestBody 
   * @returns `processID` and all `stdout` and `stderr` that the process outputted until now.
   */
  @Post('{id}/processes')
  public async startProcess(
    @Path() id: string,
    @Body() requestBody: StartProcessParams,
    @Query() wait?: boolean,
  ): Promise<ProcessResponse> {
    const cachedProcess = await CachedSession
      .findSession(id)
      .startProcess(requestBody)

    if (wait) {
      await cachedProcess.process?.exited
    }

    return cachedProcess.response
  }

  @Delete('{id}/processes/{processID}')
  public async stopProcess(
    @Path() id: string,
    @Path() processID: string,
    @Query('results') results?: boolean
  ): Promise<ProcessResponse | undefined> {
    const cachedProcess = await CachedSession
      .findSession(id)
      .stopProcess(processID)

    if (cachedProcess && results) {
      return cachedProcess.response
    }
  }

  @Post('{id}/processes/{processID}/stdin')
  public async writeProcessStdin(
    @Path() id: string,
    @Path() processID: string,
    @BodyProp('stdin') stdin: string,
  ): Promise<void> {
    await CachedSession
      .findSession(id)
      .findProcess(processID)
      ?.process
      ?.sendStdin(stdin)
  }

  /**
   * 
   * @param id 
   * @param processID 
   * @param wait if true the request will wait until the process ends and then return the `stdout`, `stderr` and `processID`.
   * @returns `processID` and all `stdout` and `stderr` that the process outputted until now.
   */
  @Get('{id}/processes/{processID}')
  public async getProcess(
    @Path() id: string,
    @Path() processID: string,
    @Query() wait?: boolean,
  ): Promise<ProcessResponse> {
    const cachedProcess = CachedSession
      .findSession(id)
      .findProcess(processID)

    if (wait) {
      await cachedProcess?.process?.exited
    }

    return cachedProcess?.response!
  }
}
