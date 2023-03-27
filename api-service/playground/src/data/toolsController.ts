import {
  Controller,
  Get,
  Route,
  Query,
} from 'tsoa'
import { waitForLogOutput } from './logOutput'

interface ToolsLogOutput {
  response: string
}

@Route('tools')
export class ToolsController extends Controller {
  @Get('logOutput')
  public async waitForLogOutput(
    @Query() runID: string,
  ): Promise<ToolsLogOutput> {
    const response = await waitForLogOutput({
      runID,
    })

    return {
      response,
    }
  }
}
