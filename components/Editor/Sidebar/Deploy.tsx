import { memo, useState } from 'react'
import Link from 'next/link'

import api from 'api-client/api'
import Text from 'components/Text'
import { projects } from 'db/prisma'
import { useStateStore } from 'state/StoreProvider'
import { evaluatePrompt } from 'state/prompt'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import { getModelArgs } from 'state/model'
import Button from 'components/Button'
import Spinner from 'components/Spinner'
import useDeployment from 'hooks/useDeployment'


const createDeployment = api.path('/deployments').method('put').create({
  project_id: true,
})

export interface Props {
  project: projects
}

function getSnippet(hostname: string, deploymentID: string) {
  return `curl --request POST \
  --url http://${hostname}/deployments/${deploymentID}/interactions \
  --data '{
  "type": "start",
  "data": {
		"instructions": {}
	}
}'`
}

function Deploy({ project }: Props) {
  const [selectors] = useStateStore()
  const modelConfig = selectors.use.getSelectedModelConfig()()
  const templateID = selectors.use.templateID()
  const [isDeploying, setIsDeploying] = useState(false)

  const [creds] = useModelProviderArgs()

  const deployment = useDeployment(project)

  const baseDeploymentURL = deployment ? `${process.env.NEXT_PUBLIC_API_URL}/deployments/${deployment.id}` : undefined

  async function deployAgent() {
    try {
      setIsDeploying(true)
      if (!modelConfig) {
        console.error('Cannot get model config')
        return
      }
      const {
        references: promptReferences,
        prompt: evaluatedPrompt,
      } = evaluatePrompt(modelConfig.prompt)

      await createDeployment({
        // TODO: Add current envs vars and save them on backend
        project_id: project.id,
        config: {
          name: modelConfig.name,
          provider: modelConfig.provider,
          args: getModelArgs(modelConfig, creds) as any,
          prompt: evaluatedPrompt,
          templateID,
          // TODO: Handle prompt references
          // prompt_references: promptReferences,
        } as any,
      })
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="
    flex
    flex-col
  ">
      <div className="
        flex
        bg-slate-50
        items-center
        justify-between
        border-b
        py-3.5
        pr-4
      ">
        <Text
          text="Deploy"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
            px-4
          "
        />
      </div>
      <div className="
      flex
      flex-col
      p-4
      space-y-4
      "
      >
        <div
          className=""
        >
          <Button
            text={isDeploying ? 'Deploying' : 'Deploy'}
            isDisabled={isDeploying}
            icon={isDeploying ? <Spinner /> : ''}
            onClick={deployAgent}
            variant={Button.variant.Full}
          />
        </div>
        <div
          className="
        "
        >
          {deployment && deployment['config'] && baseDeploymentURL &&
            <div
              className="
                flex
                flex-col
              "
            >
              <Text
                size={Text.size.S3}
                text={`Deployment ID: ${deployment.id}`}
              />
              <Link
                href={baseDeploymentURL}
                target="_blank"
                rel="noopener noreferrers"
                className="text-sm"
              >
                {baseDeploymentURL}
              </Link>
            </div>
          }
        </div>
        {deployment && deployment['config'] && baseDeploymentURL &&
          <div className="
            flex
            flex-col
            space-y-2
          ">
            <div>
              <Text
                text="Example usage"
              />
              <pre className="
            p-2
            rounded
            font-mono
            text-xs
            bg-slate-100
            overflow-auto
          ">
                <code>
                  {`curl --request POST \\
  --url ${baseDeploymentURL}/interactions \\
  --data '{
  "type": "start",
  "data": {
		"instructions": {
			"Description": "Add Stripe Checkout",
			"RepoURL": "https://github.com/e2b-dev/test.git"
		}
	}
}'`}
                </code>
              </pre>
            </div>
            <div>
              <Text
                text="Agent logs"
              />
              <pre className="
            p-2
            rounded
            font-mono
            text-xs
            bg-slate-100
            overflow-auto
          ">
                <code>
                  {`curl --request GET \\
  --url ${baseDeploymentURL}/logs`}
                </code>
              </pre>
            </div>
          </div>
        }
      </div>
    </div>
  )
}

export default memo(Deploy)
