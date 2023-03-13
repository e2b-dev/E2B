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
  bodyData: string
}

@Route('mock')
export class MockController extends Controller {
  @Post('body')
  public async createMockBodyData(
    @BodyProp('files') files: File[],
    @BodyProp('targetInterface') targetInterface: string,
  ): Promise<MockDataResponse> {

    const data = mock({
      files: files.map(f => [f.name, f.content]),
      output: 'json',
      interfaces: [targetInterface],
    })

    return {
      bodyData: data as string,
    }
  }
}
