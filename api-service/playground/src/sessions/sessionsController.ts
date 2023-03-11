import {
  Body,
  Controller,
  Delete,
  Path,
  Post,
  Route,
} from 'tsoa'

import { closeSession, initSession } from './sessions'

interface CreateSessionParams {
  envID: string
}

interface CreateSessionResponse {
  id: string
}

@Route('sessions')
export class UsersController extends Controller {
  @Post()
  public async createSession(
    @Body() requestBody: CreateSessionParams,
  ): Promise<CreateSessionResponse> {
    const id = await initSession(requestBody.envID)
    return { id }
  }

  @Delete('{id}')
  public async deleteSession(
    @Path() id: string,
  ): Promise<void> {
    await closeSession(id)
  }
}
