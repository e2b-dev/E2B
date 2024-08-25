import * as e2b from 'e2b'
import * as fs from 'fs'
import Docker from 'dockerode'
import prettyBytes from 'pretty-bytes'

const docker = new Docker()

export function dockerConnect({ accessToken }: { accessToken: string }) {
  return new Promise<void>((resolve) => {
    docker.checkAuth(
      {
        registry: `docker.${e2b.SANDBOX_DOMAIN}`,
        authconfig: {
          username: '_e2b_access_token',
          password: accessToken,
        },
      },
      (err, res) => {
        if (err) {
          console.error(
            'Docker login failed. Please try to log in with `e2b auth login` and try again.'
          )
          console.error(err)
          process.exit(1)
        } else {
          if (res.Status === 'Login Succeeded') {
            console.log('Docker login successful.')
            resolve()
          } else {
            console.error(`Docker login failed. ${res.Status}`)
            process.exit(1)
          }
        }
      }
    )
  })
}

export async function dockerBuild({
  dockerfileRelativePath,
  dockerBuildArgs,
  tag,
  root,
}: {
  dockerfileRelativePath: string;
  tag: string;
  dockerBuildArgs: { [key: string]: string };
  root: string;
}) {
  console.log('Building docker image...')

  const buildStream = await docker.buildImage(
    {
      context: root,
      src: fs.readdirSync(root),
    },
    {
      t: tag,
      platform: 'linux/amd64',
      buildargs: dockerBuildArgs,
      dockerfile: dockerfileRelativePath,
    }
  )

  const buildProgress = new Map()
  for await (const chunk of buildStream) {
    prettyPrintDockerLogs(chunk.toString('utf-8'), buildProgress)
  }

  console.log('Docker image built.\n')
}

export async function pushDockerImage({
  tag,
  accessToken,
}: {
  tag: string;
  accessToken: string;
}) {
  console.log('Pushing docker image...')

  const img = docker.getImage(tag)
  const pushStream = await img.push({
    authconfig: {
      username: '_e2b_access_token',
      password: accessToken,
      serveraddress: `docker.${e2b.SANDBOX_DOMAIN}`,
    },
  })

  const pushProgress = new Map()
  for await (const chunk of pushStream) {
    prettyPrintDockerLogs(chunk.toString('utf-8'), pushProgress)
  }

  console.log('Docker image pushed.\n')
}

function clearLines(lines: number) {
  for (let i = 0; i < lines; i++) {
    process.stdout.moveCursor(0, -1)
    process.stdout.clearLine(0)
  }
}

export async function prettyPrintDockerLogs(
  c: string,
  progress: Map<string, any>
) {
  c.split('\n').forEach((chunk) => {
    let line
    try {
      line = JSON.parse(chunk)
    } catch (e) {
      // ignore
    }

    if (line) {
      if (line.stream) {
        process.stdout.write(line.stream)
      }

      if (line.error) {
        console.error(line.error)
        process.exit(1)
      }

      if (line.status) {
        if (line.id) {
          clearLines(progress.size)
          progress.set(line.id, line)

          const isTerminalWide =
            process.stdout.columns && process.stdout.columns >= 115
          for (const l of progress.values()) {
            process.stdout.write(
              `${l.status}: ${l.id} ${
                l.progress
                  ? isTerminalWide
                    ? l.progress
                    : `[${prettyBytes(l.progressDetail.current)}/${prettyBytes(
                        l.progressDetail.total
                      )}]`
                  : ''
              }\n`
            )
          }
        } else {
          process.stdout.write(line.status + '\n')
        }
      }
    }
  })
}
