import {
  Controller,
  Delete,
  Path,
  Post,
  BodyProp,
  Route,
} from 'tsoa'

import { closeSession, initSession } from './sessions'

interface CreateSessionResponse {
  id: string
}

@Route('sessions')
export class SessionsController extends Controller {
  @Post()
  public async createSessions(
    @BodyProp('envID') envID: string,
  ): Promise<CreateSessionResponse> {
    const id = await initSession(envID)
    return { id }
  }

  @Delete('{id}')
  public async deleteSession(
    @Path() id: string,
  ): Promise<void> {
    await closeSession(id)
  }
}
