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

import { CachedSession } from './session'

interface ListFilesystemDirResponse {
  entries: EntryInfo[]
}

interface ReadFilesystemFileResponse {
  content: string
}

@Route('sessions')
export class FilesystemController extends Controller {
  @Get('{id}/filesystem/dir')
  public async listFilesystemDir(
    @Path() id: string,
    @Query() path: string,
  ): Promise<ListFilesystemDirResponse> {
    const entries = await CachedSession
      .findSession(id)
      .session
      .filesystem!
      .list(path)

    return {
      entries,
    }
  }

  @Put('{id}/filesystem/dir')
  public async makeFilesystemDir(
    @Path() id: string,
    @Query() path: string,
  ): Promise<void> {
    await CachedSession
      .findSession(id)
      .session
      .filesystem
      ?.makeDir(path)
  }

  @Delete('{id}/filesystem')
  public async deleteFilesystemEntry(
    @Path() id: string,
    @Query() path: string,
  ) {
    await CachedSession
      .findSession(id)
      .session
      .filesystem!
      .remove(path)
  }

  @Get('{id}/filesystem/file')
  public async readFilesystemFile(
    @Path() id: string,
    @Query() path: string,
  ): Promise<ReadFilesystemFileResponse> {
    const content = await CachedSession
      .findSession(id)
      .session
      .filesystem!
      .read(path)

    return {
      content,
    }
  }

  @Put('{id}/filesystem/file')
  public async writeFilesystemFile(
    @Path() id: string,
    @Query() path: string,
    @BodyProp('content') content: string,
  ) {
    await CachedSession
      .findSession(id)
      .session
      .filesystem!
      .write(path, content)
  }
}
