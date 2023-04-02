import {
  Controller,
  BodyProp,
  Put,
  Path,
  Route,
  Query,
} from 'tsoa'
import { EnvVars } from '@devbookhq/sdk'

import { createDeploymentInSession } from './deployment'
import { CachedSession } from '../sessions/session'

interface DeploymentResponse {
  /**
   * If the function is deployed for the first time the url will be defined.
   */
  url?: string
}

@Route('deployments')
export class DeploymentsController extends Controller {
  /**
   * 
   * @param projectID 
   * @param sessionID active session to use for deployment
   * @param envVars 
  */
  @Put('{projectID}')
  public async createDeployment(
    @Path() projectID: string,
    @Query() sessionID: string,
    @BodyProp() envVars?: EnvVars,
  ): Promise<DeploymentResponse> {
    const cachedSession = CachedSession.findSession(sessionID)
    const url = await createDeploymentInSession(
      cachedSession.session,
      projectID,
      envVars,
    )

    return {
      url,
    }
  }
}
