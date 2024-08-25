import * as e2b from 'e2b'
import { asLocalRelative } from 'src/utils/format'

import { client } from 'src/api'

const requestTemplateBuild = e2b.withAccessToken(
  client.api.path('/templates').method('post').create()
)

const requestTemplateRebuild = e2b.withAccessToken(
  client.api.path('/templates/{templateID}').method('post').create()
)

export async function requestBuildTemplate(
  accessToken: string,
  args: e2b.paths['/templates']['post']['requestBody']['content']['application/json'],
  hasConfig: boolean,
  configPath: string,
  templateID?: string
): Promise<
  Omit<
    e2b.paths['/templates']['post']['responses']['202']['content']['application/json'],
    'logs'
  >
> {
  let res
  if (templateID) {
    res = await requestTemplateRebuild(accessToken, { templateID, ...args })
  } else {
    res = await requestTemplateBuild(accessToken, args)
  }

  if (!res.ok) {
    const error:
      | e2b.paths['/templates']['post']['responses']['401']['content']['application/json']
      | e2b.paths['/templates']['post']['responses']['500']['content']['application/json'] =
      res.data as any

    if (error.code === 401) {
      throw new Error(
        `Authentication error: ${res.statusText}, ${
          error.message ?? 'no message'
        }`
      )
    }

    if (error.code === 404) {
      throw new Error(
        `Sandbox template you want to build ${
          templateID ? `(${templateID})` : ''
        } not found: ${res.statusText}, ${error.message ?? 'no message'}\n${
          hasConfig
            ? `This could be caused by ${asLocalRelative(
                configPath
              )} belonging to a deleted template or a template that you don't own. If so you can delete the ${asLocalRelative(
                configPath
              )} and start building the template again.`
            : ''
        }`
      )
    }

    if (error.code === 500) {
      throw new Error(
        `Server error: ${res.statusText}, ${error.message ?? 'no message'}`
      )
    }

    throw new Error(
      `API request failed: ${res.statusText}, ${error.message ?? 'no message'}`
    )
  }

  return res.data as any
}

const triggerTemplateBuild = e2b.withAccessToken(
  client.api
    .path('/templates/{templateID}/builds/{buildID}')
    .method('post')
    .create()
)

export async function triggerBuild(
  accessToken: string,
  templateID: string,
  buildID: string
) {
  const res = await triggerTemplateBuild(accessToken, { templateID, buildID })

  if (!res.ok) {
    const error:
      | e2b.paths['/templates/{templateID}/builds/{buildID}']['post']['responses']['401']['content']['application/json']
      | e2b.paths['/templates/{templateID}/builds/{buildID}']['post']['responses']['500']['content']['application/json'] =
      res.data as any

    if (error.code === 401) {
      throw new Error(
        `Authentication error: ${res.statusText}, ${
          error.message ?? 'no message'
        }`
      )
    }

    if (error.code === 500) {
      throw new Error(
        `Server error: ${res.statusText}, ${error.message ?? 'no message'}`
      )
    }

    throw new Error(
      `API request failed: ${res.statusText}, ${error.message ?? 'no message'}`
    )
  }

  return
}
