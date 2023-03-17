import {
  Controller,
  BodyProp,
  Put,
  Path,
  Route,
  Query,
} from 'tsoa'
import { EnvVars } from '@devbookhq/sdk'

import {
  createDeploymentInSession,
  updateDeploymentInSession,
} from './deployment'
import { CachedSession } from '../sessions/session'


@Route('deployments')
export class DeploymentsController extends Controller {
  /**
   * 
   * @param projectID 
   * @param sessionID active session to use for deployment
   * @param code 
   * @param envVars 
   */
  @Put('{projectID}')
  public async createDeployment(
    @Path() projectID: string,
    @Query() sessionID: string,
    @BodyProp() code: string,
    @BodyProp() envVars: EnvVars = {},
    @Query() update?: boolean,
  ): Promise<void> {
    const cachedSession = CachedSession.findSession(sessionID)

    if (update) {
      await updateDeploymentInSession(
        cachedSession.session,
        projectID,
        code,
        envVars,
      )
    } else {
      await createDeploymentInSession(
        cachedSession.session,
        projectID,
        code,
        envVars,
      )
    }
  }
}
