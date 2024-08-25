import * as e2b from 'e2b'
import * as child_process from 'child_process'

export function dockerConnect(accessToken: string, root: string) {
  try {
    child_process.execSync(
      `echo "${accessToken}" | docker login docker.${e2b.SANDBOX_DOMAIN} -u _e2b_access_token --password-stdin`,
      {
        stdio: 'inherit',
        cwd: root,
      }
    )
  } catch (err: any) {
    console.error(
      'Docker login failed. Please try to log in with `e2b auth login` and try again.'
    )
    process.exit(1)
  }
  process.stdout.write('\n')
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
