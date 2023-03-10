import { deployment_state } from '@prisma/client'
import { ReactNode } from 'react'

import Button from 'components/Button'
import Spinner from 'components/Spinner'
import { Check } from 'lucide-react'

export interface Props {
  deploy: () => void
  deployStatus?: deployment_state | null
  isInitializingDeploy?: boolean
}

interface DeploymentRepresentation {
  text: string
  icon: ReactNode | null
}

function getDeploymentRepresentation(deployStatus: deployment_state | null | undefined, isInitializingDeploy: boolean | undefined): DeploymentRepresentation {
  if (isInitializingDeploy) {
    return {
      text: 'Initializing...',
      icon: <Spinner />,
    }
  }

  switch (deployStatus) {
    case deployment_state.generating:
      return {
        text: 'Generating...',
        icon: <Spinner />,
      }
    case deployment_state.deploying:
      return {
        text: 'Deploying...',
        icon: <Spinner />,
      }
    case deployment_state.error:
      return {
        text: 'Failed',
        icon: null,
      }
    case deployment_state.finished:
      return {
        text: 'Deployed',
        icon: <Check size="16px" />
      }
    default:
      return {
        text: 'Deploy',
        icon: null,
      }
  }
}

function DeployButton({
  deploy,
  deployStatus,
  isInitializingDeploy,
}: Props) {
  const representation = getDeploymentRepresentation(deployStatus, isInitializingDeploy)

  return (
    <Button
      text={representation.text}
      onClick={deploy}
      variant={Button.variant.Full}
      icon={representation.icon}
    />
  )
}

export default DeployButton
