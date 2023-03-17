import {
  Controller,
  Post,
  BodyProp,
  Route,
} from 'tsoa'
import { EnvVars } from '@devbookhq/sdk'

import { deploy } from './deploy'

@Route('deployments')
export class DeploymentsController extends Controller {
  @Post()
  public async createSessions(
    @BodyProp('projectID') projectID: string,
    @BodyProp('code') code: string,
    @BodyProp('packageJSON') packageJSON: string,
    @BodyProp('envVars') envVars: EnvVars,
  ): Promise<void> {
    await deploy(projectID, code, packageJSON, envVars)
  }
}
