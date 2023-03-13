import {
  Controller,
  Delete,
  Path,
  Get,
  Post,
  BodyProp,
  Route,
} from 'tsoa'

import { CachedSession } from './session'
import { OpenedPort as OpenPort } from '@devbookhq/sdk'

interface SessionResponse {
  id: string
  ports: OpenPort[]
}

@Route('sessions')
export class SessionsController extends Controller {
  @Post()
  public async createSessions(
    @BodyProp('envID') envID: string,
  ): Promise<SessionResponse> {
    const cachedSession = await new CachedSession(envID).init()

    return {
      id: cachedSession.id!,
      ports: cachedSession.ports,
    }
  }

  @Delete('{id}')
  public async deleteSession(
    @Path() id: string,
  ): Promise<void> {
    await CachedSession
      .findSession(id)
      .delete()
  }

  @Get('{id}')
  public async getSession(
    @Path() id: string,
  ): Promise<SessionResponse> {
    const cachedSession = CachedSession.findSession(id)

    return {
      id: cachedSession.id!,
      ports: cachedSession.ports,
    }
  }
}
