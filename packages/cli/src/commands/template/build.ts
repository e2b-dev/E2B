import * as commander from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as e2b from 'e2b'
import * as stripAnsi from 'strip-ansi'
import * as boxen from 'boxen'
import * as cliProgress from 'cli-progress';
import chalk from 'chalk';

import { wait } from 'src/utils/wait'
import { ensureAccessToken } from 'src/api'
import { getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asBuildLogs,
  asFormattedSandboxTemplate,
  asLocal,
  asLocalRelative,
  asPrimary,
  asPython,
  asTypescript,
  withDelimiter,
} from 'src/utils/format'
import { configOption, pathOption } from 'src/options'
import {
  defaultDockerfileName,
  fallbackDockerfileName,
} from 'src/docker/constants'
import { configName, getConfigPath, loadConfig, saveConfig } from 'src/config'

import { client } from 'src/api'

import Docker from 'dockerode'

const templateCheckInterval = 500 // 0.5 sec

const getTemplate = e2b.withAccessToken(
  client.api
    .path('/templates/{templateID}/builds/{buildID}/status')
    .method('get')
    .create(),
)

const requestTemplateBuild = e2b.withAccessToken(
  client.api.path('/templates').method('post').create(),
)

const requestTemplateRebuild = e2b.withAccessToken(
  client.api.path('/templates/{templateID}').method('post').create(),
)

const triggerTemplateBuild = e2b.withAccessToken(
  client.api
    .path('/templates/{templateID}/builds/{buildID}')
    .method('post')
    .create(),
)

export const buildCommand = new commander.Command('build')
  .description(
    `build sandbox template defined by ${asLocalRelative(
      defaultDockerfileName,
    )} or ${asLocalRelative(
      fallbackDockerfileName,
    )} in root directory. By default the root directory is the current working directory. This command also creates ${asLocal(
      configName,
    )} config.`,
  )
  .argument(
    '[template]',
    `specify ${asBold(
      '[template]',
    )} to rebuild it. If you don't specify ${asBold(
      '[template]',
    )} and there is no ${asLocal(
      'e2b.toml',
    )} a new sandbox template will be created.`,
  )
  .addOption(pathOption)
  .option(
    '-d, --dockerfile <file>',
    `specify path to Dockerfile. By default E2B tries to find ${asLocal(
      defaultDockerfileName,
    )} or ${asLocal(fallbackDockerfileName)} in root directory.`,
  )
  .option(
    '-n, --name <template-name>',
    'specify sandbox template name. You can use the template name to start the sandbox with SDK. The template name must be lowercase and contain only letters, numbers, dashes and underscores.',
  )
  .option(
    '-c, --cmd <start-command>',
    'specify command that will be executed when the sandbox is started.',
  )
  .addOption(configOption)
  .option(
    '--cpu-count <cpu-count>',
    'specify the number of CPUs that will be used to run the sandbox. The default value is 2.',
    parseInt,
  )
  .option(
    '--memory-mb <memory-mb>',
    'specify the amount of memory in megabytes that will be used to run the sandbox. Must be an even number. The default value is 512.',
    parseInt,
  )
  .option(
    '--build-arg <args...>',
    'specify additional build arguments for the build command. The format should be <varname>=<value>.',
  )
  .alias('bd')
  .action(async (templateID, opts) => {
    try {
      const accessToken = ensureAccessToken();
      const accessTokenCreds = {
        username: '_e2b_access_token',
        password: accessToken,
        serveraddress: `docker.${e2b.SANDBOX_DOMAIN}`
      }

      const docker = new Docker();
      await docker.ping().then((data: any) => {
        console.log(`Pinging docker daemon... ${data}.\nNode Docker API instance is running and is ready to use.\n`)
      })
      const newName = opts.name?.trim();
      if (newName && !/^[a-z0-9-_]+$/.test(newName)) {
        console.error(
          `Name ${asLocal(
            newName,
          )} is not valid. Name can only contain lowercase letters, numbers, dashes and underscores.`,
        );
        process.exit(1);
      }

      let dockerfile = opts.dockerfile;
      let startCmd = opts.cmd;
      let cpuCount = opts.cpuCount;
      let memoryMB = opts.memoryMb;

      const root = getRoot(opts.path);
      const configPath = getConfigPath(root, opts.config);

      const config = fs.existsSync(configPath)
        ? await loadConfig(configPath)
        : undefined;

      const relativeConfigPath = path.relative(root, configPath);

      if (config) {
        console.log(
          `Found sandbox template ${asFormattedSandboxTemplate(
            {
              templateID: config.template_id,
              aliases: config.template_name ? [config.template_name] : undefined,
            },
            relativeConfigPath,
          )}`,
        );
        templateID = config.template_id;
        dockerfile = opts.dockerfile || config.dockerfile;
        startCmd = opts.cmd || config.start_cmd;
        cpuCount = opts.cpuCount || config.cpu_count;
        memoryMB = opts.memoryMb || config.memory_mb;
      }

      if (config && templateID && config.template_id !== templateID) {
        console.error(
          "You can't specify different ID than the one in config. If you want to build a new sandbox template remove the config file.",
        );
        process.exit(1);
      }

      if (newName && config?.template_name && newName !== config?.template_name) {
        console.log(
          `The sandbox template name will be changed from ${asLocal(
            config.template_name,
          )} to ${asLocal(newName)}.`,
        );
      }
      const name = newName || config?.template_name;

      const dockerfiles = fs.readdirSync(root).filter(file => file.endsWith('Dockerfile'))
      //const dockerfiles = fs.readdirSync(root).filter(file => file.toLowerCase().includes('dockerfile'))
      let df = dockerfile || dockerfiles[0];
      if (!df) {
        console.error("No Dockerfile given and no dockerfiles found in the root directory. Please specify a Dockerfile or a dockerfile in the root directory.");
        process.exit(1);
      }
      const dfPath = path.join(root, df);
      const dfContent = fs.readFileSync(dfPath, 'utf-8');
      const dfRelativePath = path.relative(root, dfPath);

      console.log(
        `Found ${asLocalRelative(dfRelativePath)} that will be used to build the sandbox template.`,
      );

      const body = {
        alias: name,
        startCmd: startCmd,
        cpuCount: cpuCount,
        memoryMB: memoryMB,
        dockerfile: dfContent,
      };

      if (opts.memoryMb && opts.memoryMb % 2 !== 0) {
        console.error(
          `The memory in megabytes must be an even number. You provided ${asLocal(
            opts.memoryMb.toFixed(0),
          )}.`,
        );
        process.exit(1);
      }

      const template = await requestBuildTemplate(
        accessToken,
        body,
        !!config,
        relativeConfigPath,
        templateID,
      );
      templateID = template.templateID;

      console.log(
        `Requested build for the sandbox template ${asFormattedSandboxTemplate(
          template,
        )} `,
      );

      await saveConfig(
        configPath,
        {
          template_id: templateID,
          dockerfile: dfRelativePath,
          template_name: name,
          start_cmd: startCmd,
          cpu_count: cpuCount,
          memory_mb: memoryMB,
        },
        true,
      );

      /*
      interface DockerAuthResponse {
        Status: string;
        IdentityToken: string;
      }
      IdentityToken is not returned in the response. Can be used in authConfig for pushing the image.
      */
      await docker.checkAuth(accessTokenCreds).then((data: { Status: string, IdentityToken: string }) => {
        console.log(`Status: ${data.Status}`)
        console.log(`IdentityToken: ${data.IdentityToken || 'No identity token provided.'}\n`)
      });

      const multiBar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {percentage}% | {value}/{total} | {task}',
        autopadding: true,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591'
      }, cliProgress.Presets.shades_grey);


      const imageTag = `docker.${e2b.SANDBOX_DOMAIN}/e2b/custom-envs/${templateID}:${template.buildID}`
      let buildStream = await docker.buildImage(
        {
          context: root,
          src: [dfRelativePath],
        },
        {
          t: imageTag,
          buildargs: opts.buildArg ? Object.fromEntries(opts.buildArg.map((arg: string) => arg.split('='))) : undefined,
          platform: 'linux/amd64'
        }
      );

      await handleDockerProgress(buildStream, 'Building', docker);
      process.stdout.write('\n');

      const image = docker.getImage(imageTag);
      let pushStream = await image.push({ authconfig: accessTokenCreds });
      await handleDockerProgress(pushStream, 'Pushing', docker);

      multiBar.stop();

      await triggerBuild(accessToken, templateID, template.buildID);
      console.log(
        `\nTriggered build for the sandbox template ${asFormattedSandboxTemplate(
          template,
        )}`,
      );

      console.log('Waiting for build to finish...');
      await waitForBuildFinish(accessToken, templateID, template.buildID, name);

      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

interface ProgressBarInfo {
  bar: cliProgress.SingleBar;
  id: string;
}

function handleDockerProgress(stream: NodeJS.ReadableStream, processName: string, docker: Docker): Promise<void> {
  return new Promise((resolve, reject) => {
    const multiBar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: (options, params, payload) => {
        const percentage = Math.round(params.progress * 100);
        const width = options.barsize || 40;
        const completeSize = Math.round(width * params.progress);
        const incompleteSize = width - completeSize;

        const completeBar = '█'.repeat(completeSize);
        const incompleteBar = '░'.repeat(incompleteSize);

        if (percentage === 100) {
          return chalk.green(`✓ ${chalk.bold(payload.task)} | ${chalk.bold('100%')} | ${chalk.dim('Completed')}`);
        }

        return `${chalk.green(completeBar)}${chalk.gray(incompleteBar)} | ${chalk.yellow(`${percentage}%`)} | ${chalk.cyan(payload.task)}`;
      },
    }, cliProgress.Presets.shades_classic);

    const progressBars: { [key: string]: ProgressBarInfo } = {};
    let generalBar = multiBar.create(100, 0, { task: `${processName}: Overall Progress` });
    let generalProgress = 0;
    let errorOccurred = false;

    console.log(chalk.cyan(`\n=== ${processName} Docker Image ===\n`));

    docker.modem.followProgress(
      stream,
      (err: Error | null, res: any[] | null) => {
        if (err || errorOccurred) {
          Object.values(progressBars).forEach(({ bar }) => bar.stop());
          generalBar.stop();
          multiBar.stop();
          console.error(chalk.red(`\n✘ Error during ${processName.toLowerCase()}: ${err?.message || 'An unknown error occurred'}`));
          reject(err || new Error('An error occurred during the Docker operation'));
        } else {
          Object.values(progressBars).forEach(({ bar }) => bar.stop());
          generalBar.update(100, { task: `${processName} completed successfully` });
          generalBar.stop();
          multiBar.stop();
          resolve();
        }
      },
      (event: any) => {
        if (event.error) {
          errorOccurred = true;
          console.error(chalk.red(`\n✘ Error during ${processName.toLowerCase()}: ${event.error}`));
          return;
        }

        if (event.stream) {
          const message = stripAnsi.default(event.stream.trim());
          if (message) {
            console.log(chalk.dim(message));
            generalProgress = Math.min(generalProgress + 1, 98);
            generalBar.update(generalProgress, { task: `${processName}: Processing` });
          }
        } else if (event.status) {
          let id = event.id || 'general';
          let statusText = event.status;

          if (event.progress) {
            statusText += ' ' + event.progress;
          }

          if (id !== 'general') {
            if (!progressBars[id]) {
              const bar = multiBar.create(100, 0, { task: `${id}: Waiting` });
              progressBars[id] = { bar, id };
            }

            const { bar } = progressBars[id];

            if (event.progressDetail && typeof event.progressDetail.current === 'number' && typeof event.progressDetail.total === 'number') {
              const percent = Math.floor((event.progressDetail.current / event.progressDetail.total) * 100);
              bar.update(percent, { task: `${id}: ${statusText}` });
            } else {
              const currentValue = bar.getProgress();
              bar.update(Math.min(currentValue + 5, 99), { task: `${id}: ${statusText}` });
            }

            if (statusText.includes('Layer already exists') || statusText.includes('Mounted from') || statusText.includes('Pushed')) {
              bar.update(100, { task: `${id}: ${statusText}` });
              bar.stop();
              delete progressBars[id];
            }

            const activeBars = Object.values(progressBars);
            const totalProgress = activeBars.reduce((sum, { bar }) => sum + bar.getProgress(), 0);
            generalProgress = Math.floor(totalProgress / (activeBars.length || 1));
            generalBar.update(generalProgress, { task: `${processName}: Overall Progress` });
          }
        } else if (event.aux) {
          generalBar.update(99, { task: `${processName}: Finalizing` });
        }
      }
    );
  });
}

async function waitForBuildFinish(
  accessToken: string,
  templateID: string,
  buildID: string,
  name?: string,
) {
  let logsOffset = 0

  let template: Awaited<ReturnType<typeof getTemplate>> | undefined
  const aliases = name ? [name] : undefined

  process.stdout.write('\n')
  do {
    await wait(templateCheckInterval)

    try {
      template = await getTemplate(accessToken, {
        templateID,
        logsOffset,
        buildID,
      })
    } catch (e) {
      if (e instanceof getTemplate.Error) {
        const error = e.getActualType()
        if (error.status === 401) {
          throw new Error(
            `Error getting build info - (${error.status}) bad request: ${error.data.message}`,
          )
        }
        if (error.status === 404) {
          throw new Error(
            `Error getting build info - (${error.status}) not found: ${error.data.message}`,
          )
        }
        if (error.status === 500) {
          throw new Error(
            `Error getting build info - (${error.status}) server error: ${error.data.message}`,
          )
        }
      }
      throw e
    }

    logsOffset += template.data.logs.length

    switch (template.data.status) {
      case 'building':
        template.data.logs.forEach((line) =>
          process.stdout.write(asBuildLogs(stripAnsi.default(line))),
        )
        break
      case 'ready': {
        const pythonExample = asPython(`from e2b import Sandbox

# Start sandbox
sandbox = Sandbox(template="${aliases?.length ? aliases[0] : template.data.templateID
          }")

# Interact with sandbox. Learn more here:
# https://e2b.dev/docs/sandbox/overview

# Close sandbox once done
sandbox.close()`)

        const typescriptExample = asTypescript(`import { Sandbox } from 'e2b'

// Start sandbox
const sandbox = await Sandbox.create({ template: '${aliases?.length ? aliases[0] : template.data.templateID}' })

// Interact with sandbox. Learn more here:
// https://e2b.dev/docs/sandbox/overview

// Close sandbox once done
await sandbox.close()`)

        const examplesMessage = `You can use E2B Python or JS SDK to spawn sandboxes now.
Find more here - ${asPrimary(
          'https://e2b.dev/docs/guide/custom-sandbox',
        )} in ${asBold('Spawn and control your sandbox')} section.`

        const exampleHeader = boxen.default(examplesMessage, {
          padding: {
            bottom: 1,
            top: 1,
            left: 2,
            right: 2,
          },
          margin: {
            top: 1,
            bottom: 1,
            left: 0,
            right: 0,
          },
          fullscreen(width) {
            return [width, 0]
          },
          float: 'left',
        })

        const exampleUsage = `${withDelimiter(
          pythonExample,
          'Python SDK',
        )}\n${withDelimiter(typescriptExample, 'JS SDK', true)}`

        console.log(
          `\n✅ Building sandbox template ${asFormattedSandboxTemplate({
            aliases,
            ...template.data,
          })} finished.\n${exampleHeader}\n${exampleUsage}\n`,
        )
        break
      }
      case 'error':
        template.data.logs.forEach((line) =>
          process.stdout.write(asBuildLogs(stripAnsi.default(line))),
        )
        throw new Error(
          `\n❌ Building sandbox template ${asFormattedSandboxTemplate({
            aliases,
            ...template.data,
          })} failed.\nCheck the logs above for more details or contact us ${asPrimary(
            '(https://e2b.dev/docs/getting-help)',
          )} to get help.\n`,
        )
    }
  } while (template.data.status === 'building')
}

async function requestBuildTemplate(
  accessToken: string,
  args: e2b.paths['/templates']['post']['requestBody']['content']['application/json'],
  hasConfig: boolean,
  configPath: string,
  templateID?: string,
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
        `Authentication error: ${res.statusText}, ${error.message ?? 'no message'
        }`,
      )
    }

    if (error.code === 404) {
      throw new Error(
        `Sandbox template you want to build ${templateID ? `(${templateID})` : ''
        } not found: ${res.statusText}, ${error.message ?? 'no message'}\n${hasConfig
          ? `This could be caused by ${asLocalRelative(
            configPath,
          )} belonging to a deleted template or a template that you don't own. If so you can delete the ${asLocalRelative(
            configPath,
          )} and start building the template again.`
          : ''
        }`,
      )
    }

    if (error.code === 500) {
      throw new Error(
        `Server error: ${res.statusText}, ${error.message ?? 'no message'}`,
      )
    }

    throw new Error(
      `API request failed: ${res.statusText}, ${error.message ?? 'no message'}`,
    )
  }

  return res.data as any
}

async function triggerBuild(
  accessToken: string,
  templateID: string,
  buildID: string,
) {
  const res = await triggerTemplateBuild(accessToken, { templateID, buildID })

  if (!res.ok) {
    const error:
      | e2b.paths['/templates/{templateID}/builds/{buildID}']['post']['responses']['401']['content']['application/json']
      | e2b.paths['/templates/{templateID}/builds/{buildID}']['post']['responses']['500']['content']['application/json'] =
      res.data as any

    if (error.code === 401) {
      throw new Error(
        `Authentication error: ${res.statusText}, ${error.message ?? 'no message'
        }`,
      )
    }

    if (error.code === 500) {
      throw new Error(
        `Server error: ${res.statusText}, ${error.message ?? 'no message'}`,
      )
    }

    throw new Error(
      `API request failed: ${res.statusText}, ${error.message ?? 'no message'}`,
    )
  }

  return
}