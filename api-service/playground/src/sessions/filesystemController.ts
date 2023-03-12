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

import { retrieveSession } from './sessions'

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
    const session = retrieveSession(id)
    const entries = await session.filesystem!.list(path)
    return {
      entries,
    }
  }

  @Put('{id}/filesystem/dir')
  public async makeFilesystemDir(
    @Path() id: string,
    @Query() path: string,
  ): Promise<void> {
    const session = retrieveSession(id)
    await session.filesystem!.makeDir(path)
  }

  @Delete('{id}/filesystem')
  public async deleteFilesystemEntry(
    @Path() id: string,
    @Query() path: string,
  ) {
    const session = retrieveSession(id)
    await session.filesystem!.remove(path)
  }

  @Get('{id}/filesystem/file')
  public async readFilesystemFile(
    @Path() id: string,
    @Query() path: string,
  ): Promise<ReadFilesystemFileResponse> {
    const session = retrieveSession(id)
    const content = await session.filesystem!.read(path)
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
    const session = retrieveSession(id)
    await session.filesystem!.write(path, content)
  }
}
