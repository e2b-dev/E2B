import { mock } from 'intermock'
import {
  Controller,
  Post,
  BodyProp,
  Route,
} from 'tsoa'

interface File {
  name: string
  content: string
}

interface MockDataResponse {
  mockData: string | Record<string | number, {}>
}

@Route('data')
export class SessionsController extends Controller {
  @Post('mock')
  public async createMockData(
    @BodyProp('files') files: File[],
    @BodyProp('targetInterface') targetInterface: string,
  ): Promise<MockDataResponse> {

    const data = mock({
      files: files.map(f => [f.name, f.content]),
      output: 'json',
      interfaces: [targetInterface],
    })

    return {
      mockData: data,
    }
  }
}
