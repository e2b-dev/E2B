import {
  Controller,
  Path,
  Get,
  Delete,
  Put,
  Query,
  Route,
  BodyProp,
} from 'tsoa'
import { FileInfo as EntryInfo } from '@devbookhq/sdk'
import { dirname } from 'path'

import { CachedSession } from './session'

interface ListFilesystemDirResponse {
  entries: EntryInfo[]
}

interface ReadFilesystemFileResponse {
  content: string
}

@Route('sessions')
export class FilesystemController extends Controller {
  @Get('{sessionID}/filesystem/dir')
  public async listFilesystemDir(
    @Path() sessionID: string,
    @Query() path: string,
  ): Promise<ListFilesystemDirResponse> {
    const entries = await CachedSession
      .findSession(sessionID)
      .session
      .filesystem!
      .list(path)
    return {
      entries,
    }
  }

  @Put('{sessionID}/filesystem/dir')
  public async makeFilesystemDir(
    @Path() sessionID: string,
    @Query() path: string,
  ): Promise<void> {
    await CachedSession
      .findSession(sessionID)
      .session
      .filesystem
      ?.makeDir(path)
  }

  @Delete('{sessionID}/filesystem')
  public async deleteFilesystemEntry(
    @Path() sessionID: string,
    @Query() path: string,
  ) {
    await CachedSession
      .findSession(sessionID)
      .session
      .filesystem!
      .remove(path)
  }

  @Get('{sessionID}/filesystem/file')
  public async readFilesystemFile(
    @Path() sessionID: string,
    @Query() path: string,
  ): Promise<ReadFilesystemFileResponse> {
    const content = await CachedSession
      .findSession(sessionID)
      .session
      .filesystem!
      .read(path)
    return {
      content,
    }
  }

  @Put('{sessionID}/filesystem/file')
  public async writeFilesystemFile(
    @Path() sessionID: string,
    @Query() path: string,
    @BodyProp() content: string,
  ) {
    const dir = dirname(path)

    const session = CachedSession
      .findSession(sessionID)
      .session

    await session.filesystem!.makeDir(dir)
    await session.filesystem!.write(path, content)
  }
}
