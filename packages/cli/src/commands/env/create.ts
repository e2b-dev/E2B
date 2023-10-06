import * as commander from 'commander'
import { stripIndent } from 'common-tags'
import * as fs from 'fs'
import Blob from 'cross-blob' // Remove cross-blob when dropping node 16 support
import { FormData } from 'formdata-node' // Remove formdata-node when dropping node 16 support
import fsPromise from 'fs/promises'
import fetch from 'node-fetch'
import { apiBaseUrl, ensureAccessToken } from 'src/api'
import { configName } from 'src/config'
import { pathOption } from 'src/options'
import { getFiles, getRoot, packToTar } from 'src/utils/filesystem'
import {
  asBold,
  asFormattedEnvironment,
  asFormattedError,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'
import * as yup from 'yup'
import * as os from 'os'
import path from 'path'

export const createCommand = new commander.Command('create')
  .description(`Create new environment and ${asLocal(configName)} config`)
  .option(
    '-id, --id <id>',
    `Use ${asBold(
      '<id>',
    )} to override already existing environment, otherwise new environment will be created`,
  )
  .option('--respect-gitignore', 'Respect .gitignore file in the root directory', true)
  .option(
    '--respect-dockerignore',
    'Respect .dockerignore file in the root directory',
    true,
  )
  // TODO: Future
  // .option(
  //   '-t, --title <title>',
  //   `Use ${asBold('<title>')} as environment title`
  // )
  // .option(
  //   '-n, --no-config',
  //   `Skip creating ${asLocal(configName)} config`
  // )
  .addOption(pathOption)
  .alias('cr')
  .action(async opts => {
    try {
      const accessToken = ensureAccessToken()
      process.stdout.write('\n')

      const root = getRoot(opts.path)
      // const configPath = getConfigPath(root) // TODO: Future

      // TODO: Future
      // let title = opts.title as string | undefined
      // const inquirer = await import('inquirer')
      // if (!title) {
      //   title = randomTitle() // TODO: Infer from path
      // }

      const filePaths = await getFiles(root, {
        respectGitignore: opts.respectGitignore,
        respectDockerignore: opts.respectDockerignore,
      })
      if (!filePaths.length) {
        console.log(stripIndent`
          No files found in ${asLocalRelative(root)}.
          Note that .gitignore and .dockerignore files are respected by default,
          use --respect-gitignore=false and --respect-dockerignore=false to override.
       `)
        return
      }

      // const hash = getFilesHash(files) // TODO: Future
      console.log('📦 Files to be uploaded to create environment:')
      // @ts-ignore
      filePaths.map(filePath => {
        console.log(`• ${filePath.rootPath}`)
      })

      const tempDir = os.tmpdir()
      const tarPath = path.join(tempDir, 'env.tar.gz')

      await packToTar(
        root,
        // @ts-ignore
        filePaths.map(({ rootPath }) => rootPath),
        tarPath,
      )

      if (!fs.existsSync(tarPath)) throw new Error(`Tar file ${tarPath} does not exist`)

      const buildContextBlob = new Blob([fs.readFileSync(tarPath)])
      let dockerfileContent
      if (fs.existsSync(`${root}/Dockerfile`)) {
        dockerfileContent = fs.readFileSync(`${root}/Dockerfile`, 'utf-8')
      }

      // TODO: Use SDK client
      // client.path('/envs').method('post').create(...)

      const formData = new FormData()
      formData.append('buildContext', buildContextBlob, 'env.tar.gz.e2b')
      if (dockerfileContent) formData.append('dockerfile', dockerfileContent)
      // if (envID) formData.append('envID', envID); // TODO: Future

      const apiRes = await fetch(`${apiBaseUrl}/envs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      })

      if (!apiRes.ok) {
        const resJson = (await apiRes.json()) as { message: string }
        console.log('res', resJson)
        throw new Error(
          `API request failed: ${apiRes.statusText}, ${resJson?.message ?? 'no message'}`,
        )
      }
      const resJson = (await apiRes.json()) as {
        envID: string
        public: boolean
        status: 'building' | 'error' | 'ready'
      }
      console.log(`✅ Env created: ${resJson?.envID}, waiting for build to finish...`)

      const startedAt = new Date()
      let completed = false
      while (!completed) {
        await wait(5000)
        const apiResPoll = await fetch(`${apiBaseUrl}/envs/${resJson?.envID}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!apiResPoll.ok)
          throw new Error(`API request failed: ${apiResPoll.statusText}`)
        const env = (await apiResPoll.json()) as { status: string; created_at: string }
        console.log('env', env)

        if (env.status === 'building') {
          const now = new Date()
          const elapsed = now.getTime() - startedAt.getTime()
          const elapsedStr = `${Math.floor(elapsed / 1000)}s`
          console.log(`⏳ Building… (started ${elapsedStr} ago)`) // nicer
          if (elapsed > 1000 * 60 * 2) {
            // TODO
            console.log(stripIndent`
              ⚠️ Build taking longer than 2 minutes, something might be wrong.
              Stopping to wait for result, but it might still finish.
              Check by yourself by running ${asLocal('e2b env list')}
            `)
            completed = true
          }
        } else if (env.status === 'ready') {
          completed = true
          console.log(`✅ Build completed at ${env.created_at}`) // TODO: Nicer
        } else if (env.status === 'error') {
          throw new Error('Build failed')
        }
      }

      // if (shouldSaveConfig) {
      //   await ensureDir(root)
      //   const configPath = getConfigPath(root)
      //   await saveConfig(configPath, config)
      // }
    } catch (err: unknown) {
      console.error(asFormattedError((err as Error).message), err)
      process.exit(1)
    }
  })

// TODO: Move to config/index.ts after refactoring
// ===
const envConfigSchema = yup.object({
  id: yup.string().required(),
  // TODO: Not MVP
  // title: yup.string().default(randomTitle),
  // filesystem: yup.object({
  //   change_hash: yup.string(),
  //   local_root: yup.string().required().default('./files'),
  // }),
})

export type EnvConfig = yup.InferType<typeof envConfigSchema>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function saveConfig(configPath: string, config: EnvConfig, overwrite?: boolean) {
  try {
    if (!overwrite) {
      const configExists = fs.existsSync(configPath)
      if (configExists)
        throw new Error(`Config already exists on path ${asLocalRelative(configPath)}`)
    }

    const validatedConfig: any = await envConfigSchema.validate(config, {
      stripUnknown: true,
    })
    const jsonRaw = JSON.stringify(validatedConfig, null, 2)
    await fsPromise.writeFile(configPath, jsonRaw)
  } catch (err: any) {
    throw new Error(
      `e2b environment config ${asFormattedEnvironment(
        config,
        configPath,
      )} cannot be saved: ${err.message}`,
    )
  }
}

// TODO: Move to utils after refactoring
// ===
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deleteFile = async (filePath: string) => {
  const stat = await fs.promises.stat(filePath)
  if (stat.isFile()) await fs.promises.unlink(filePath)
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
