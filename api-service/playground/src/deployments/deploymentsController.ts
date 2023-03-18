import {
  Controller,
  BodyProp,
  Put,
  Path,
  Patch,
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
  ): Promise<void> {
    const cachedSession = CachedSession.findSession(sessionID)
    await createDeploymentInSession(
      cachedSession.session,
      projectID,
      code,
      envVars,
    )
  }

  /**
   * 
   * @param projectID 
   * @param sessionID active session to use for deployment
   * @param code 
   * @param envVars 
   */
  @Patch('{projectID}')
  public async updateDeployment(
    @Path() projectID: string,
    @Query() sessionID: string,
    @BodyProp() envVars?: EnvVars,
    @BodyProp() code?: string,
  ): Promise<void> {
    const cachedSession = CachedSession.findSession(sessionID)
    await updateDeploymentInSession(
      cachedSession.session,
      projectID,
      code,
      envVars,
    )
  }
}
