import { randomUUID } from 'node:crypto'
import { http, HttpResponse, type HttpHandler } from 'msw'

import { apiUrl } from '../setup'

interface MockLogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

interface MockBuild {
  templateID: string
  buildID: string
  alias: string
  tags: string[]
  triggered: boolean
  logEntries: MockLogEntry[]
  finalStatus: 'ready' | 'error'
  reason?: { message: string; step?: string }
  createdAt: string
}

interface MockBuildApiState {
  /** Builds keyed by buildID. */
  builds: Map<string, MockBuild>
  /** Template IDs keyed by alias. */
  templates: Map<string, string>
}

const VALID_USERS = new Set(['root', 'user'])

function logEntry(message: string): MockLogEntry {
  return { timestamp: new Date().toISOString(), level: 'info', message }
}

function splitName(name: string): { alias: string; tag?: string } | undefined {
  const colonIndex = name.indexOf(':')
  if (colonIndex === -1) {
    return name.length > 0 ? { alias: name } : undefined
  }
  const alias = name.slice(0, colonIndex)
  const tag = name.slice(colonIndex + 1)
  if (alias.length === 0 || tag.length === 0) {
    return undefined
  }
  return { alias, tag }
}

function badRequest(message: string) {
  return HttpResponse.json({ code: 400, message }, { status: 400 })
}

function notFound(message: string) {
  return HttpResponse.json({ code: 404, message }, { status: 404 })
}

/**
 * Stateful in-memory mock of the template build API (request build, file
 * upload links, trigger, status polling, aliases, and tags). The `base`
 * alias is pre-seeded so `fromTemplate('base')` and `Template.exists('base')`
 * work out of the box.
 */
export function createMockBuildApi(): {
  handlers: HttpHandler[]
  state: MockBuildApiState
} {
  const builds = new Map<string, MockBuild>()
  const templates = new Map<string, string>()

  function seedTemplate(alias: string) {
    const build: MockBuild = {
      templateID: randomUUID(),
      buildID: randomUUID(),
      alias,
      tags: ['latest'],
      triggered: true,
      logEntries: [logEntry('Build finished')],
      finalStatus: 'ready',
      createdAt: new Date().toISOString(),
    }
    builds.set(build.buildID, build)
    templates.set(alias, build.templateID)
  }

  seedTemplate('base')

  function latestBuildForAlias(alias: string): MockBuild | undefined {
    let latest: MockBuild | undefined
    for (const build of builds.values()) {
      if (build.alias === alias) {
        latest = build
      }
    }
    return latest
  }

  const handlers = [
    // Request a template build
    http.post(apiUrl('/v3/templates'), async ({ request }) => {
      const body = (await request.clone().json()) as {
        name: string
        tags?: string[]
      }

      const parsedName = splitName(body.name)
      if (!parsedName) {
        return badRequest(`Invalid template name: '${body.name}'`)
      }

      const { alias, tag } = parsedName
      const templateID = templates.get(alias) ?? randomUUID()
      templates.set(alias, templateID)

      const tags = [...(tag ? [tag] : []), ...(body.tags ?? [])]
      const build: MockBuild = {
        templateID,
        buildID: randomUUID(),
        alias,
        tags,
        triggered: false,
        logEntries: [],
        finalStatus: 'ready',
        createdAt: new Date().toISOString(),
      }
      builds.set(build.buildID, build)

      return HttpResponse.json({
        templateID,
        buildID: build.buildID,
        public: false,
        names: [alias],
        tags,
        aliases: [alias],
      })
    }),

    // Check whether the files for a hash are already uploaded. Always
    // reporting them as cached (with no upload URL) skips the upload step.
    http.get(apiUrl('/templates/:templateID/files/:hash'), () => {
      return HttpResponse.json({ present: true })
    }),

    // Trigger a build: simulate it synchronously by recording one log entry
    // per step, then mark the final status.
    http.post<{ templateID: string; buildID: string }>(
      apiUrl('/v2/templates/:templateID/builds/:buildID'),
      async ({ params, request }) => {
        const build = builds.get(params.buildID)
        if (!build || build.templateID !== params.templateID) {
          return notFound('Build not found')
        }

        const body = (await request.clone().json()) as {
          fromImage?: string
          fromTemplate?: string
          steps?: { type: string; args?: string[] }[]
        }

        const from = body.fromImage ?? body.fromTemplate ?? 'base'
        build.logEntries.push(logEntry(`FROM ${from}`))
        for (const [index, step] of (body.steps ?? []).entries()) {
          // RUN steps carry the user in args[1]; only users that exist in the
          // base image are accepted, like the real build backend.
          const user = step.type === 'RUN' ? step.args?.[1] : undefined
          if (user && !VALID_USERS.has(user)) {
            build.finalStatus = 'error'
            build.reason = {
              message: `failed to run command '${step.args?.[0]}': command failed: unauthenticated: invalid username: '${user}'`,
              step: String(index + 1),
            }
            break
          }
          build.logEntries.push(
            logEntry(
              `Step ${index + 1}: ${step.type} ${(step.args ?? []).join(' ')}`
            )
          )
        }
        if (build.finalStatus !== 'error') {
          build.logEntries.push(logEntry('Build finished'))
        }
        build.triggered = true

        return HttpResponse.json({}, { status: 202 })
      }
    ),

    // Poll build status: deliver the pending log entries on the first call
    // (status `building`), then report the final status once drained.
    http.get<{ templateID: string; buildID: string }>(
      apiUrl('/templates/:templateID/builds/:buildID/status'),
      ({ params, request }) => {
        const build = builds.get(params.buildID)
        if (!build || build.templateID !== params.templateID) {
          return notFound('Build not found')
        }

        const logsOffset = Number(
          new URL(request.url).searchParams.get('logsOffset') ?? 0
        )
        const logEntries = build.logEntries.slice(logsOffset)

        let status: string
        if (!build.triggered) {
          status = 'waiting'
        } else if (logEntries.length > 0) {
          status = 'building'
        } else {
          status = build.finalStatus
        }

        return HttpResponse.json({
          templateID: build.templateID,
          buildID: build.buildID,
          status,
          logEntries,
          logs: logEntries.map((entry) => entry.message),
          ...(status === 'error' ? { reason: build.reason } : {}),
        })
      }
    ),

    // Check whether an alias exists
    http.get<{ alias: string }>(
      apiUrl('/templates/aliases/:alias'),
      ({ params }) => {
        const templateID = templates.get(params.alias)
        if (!templateID) {
          return notFound('Template not found')
        }
        return HttpResponse.json({ templateID, public: false })
      }
    ),

    // Assign tags to an existing build
    http.post(apiUrl('/templates/tags'), async ({ request }) => {
      const body = (await request.clone().json()) as {
        target: string
        tags: string[]
      }

      const parsedTarget = splitName(body.target)
      if (!parsedTarget) {
        return badRequest(`Invalid target: '${body.target}'`)
      }

      const build = latestBuildForAlias(parsedTarget.alias)
      if (!build) {
        return notFound('Template not found')
      }

      // Tags may be bare ('production') or namespaced ('alias:production');
      // the API returns and stores just the tag portion.
      const tags: string[] = []
      for (const tag of body.tags) {
        const parsedTag = splitName(tag)
        if (!parsedTag) {
          return badRequest(`Invalid tag: '${tag}'`)
        }
        tags.push(parsedTag.tag ?? parsedTag.alias)
      }

      build.tags.push(...tags)

      return HttpResponse.json({ buildID: build.buildID, tags })
    }),

    // Remove tags from a template
    http.delete(apiUrl('/templates/tags'), async ({ request }) => {
      const body = (await request.clone().json()) as {
        name: string
        tags: string[]
      }

      const build = latestBuildForAlias(body.name)
      if (!build) {
        return notFound('Template not found')
      }

      build.tags = build.tags.filter((tag) => !body.tags.includes(tag))

      return new HttpResponse(null, { status: 204 })
    }),

    // List tags for a template
    http.get<{ templateID: string }>(
      apiUrl('/templates/:templateID/tags'),
      ({ params }) => {
        const templateBuilds = Array.from(builds.values()).filter(
          (build) => build.templateID === params.templateID
        )
        if (templateBuilds.length === 0) {
          return notFound('Template not found')
        }

        return HttpResponse.json(
          templateBuilds.flatMap((build) =>
            build.tags.map((tag) => ({
              tag,
              buildID: build.buildID,
              createdAt: build.createdAt,
            }))
          )
        )
      }
    ),
  ]

  return { handlers, state: { builds, templates } }
}
