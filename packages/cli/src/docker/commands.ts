import * as e2b from 'e2b'
import * as child_process from 'child_process'
import Docker from 'dockerode'

const docker = new Docker()

export function dockerConnect(accessToken: string) {
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

export function dockerBuild(
  dockerfileRelativePath: string,
  templateID: string,
  template: Omit<
    {
      templateID: string;
      buildID: string;
      cpuCount: e2b.components['schemas']['CPUCount'];
      memoryMB: e2b.components['schemas']['MemoryMB'];
      public: boolean;
      aliases?: string[];
    },
    'logs'
  >,
  dockerBuildArgs: { [key: string]: string },
  root: string
) {
  console.log('Building docker image...')
  const cmd = `docker build . -f ${dockerfileRelativePath} --pull --platform linux/amd64 -t docker.${
    e2b.SANDBOX_DOMAIN
  }/e2b/custom-envs/${templateID}:${template.buildID} ${Object.entries(
    dockerBuildArgs
  )
    .map(([key, value]) => `--build-arg="${key}=${value}"`)
    .join(' ')}`
  child_process.execSync(cmd, {
    stdio: 'inherit',
    cwd: root,
    env: {
      ...process.env,
      DOCKER_CLI_HINTS: 'false',
    },
  })
  console.log('Docker image built.\n')
}

export function pushDockerImage(
  templateID: string,
  template: Omit<
    {
      templateID: string;
      buildID: string;
      cpuCount: e2b.components['schemas']['CPUCount'];
      memoryMB: e2b.components['schemas']['MemoryMB'];
      public: boolean;
      aliases?: string[];
    },
    'logs'
  >,
  root: string
) {
  console.log('Pushing docker image...')
  child_process.execSync(
    `docker push docker.${e2b.SANDBOX_DOMAIN}/e2b/custom-envs/${templateID}:${template.buildID}`,
    {
      stdio: 'inherit',
      cwd: root,
    }
  )
  console.log('Docker image pushed.\n')
}
