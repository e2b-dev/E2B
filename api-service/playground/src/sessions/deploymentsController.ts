import {
  Controller,
  BodyProp,
  Put,
  Path,
  Route,
} from 'tsoa'
import {
  EnvVars,
} from '@devbookhq/sdk'

import { deployFromSession } from './deployment'
import { CachedSession } from './session'


@Route('sessions')
export class DeploymentsController extends Controller {
  @Put('{sessionID}/deployments')
  public async createDeployment(
    @Path() sessionID: string,
    @BodyProp('projectID') projectID: string,
    @BodyProp('code') code: string,
    @BodyProp('envVars') envVars: EnvVars = {},
  ): Promise<void> {
    const cachedSession = CachedSession.findSession(sessionID)
    await deployFromSession(
      cachedSession.session,
      projectID,
      code,
      envVars,
    )
  }
}
