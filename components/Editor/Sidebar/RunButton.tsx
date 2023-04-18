import { deployment_state } from '@prisma/client'
import { ReactNode, memo } from 'react'

import Button from 'components/Button'
import Spinner from 'components/Spinner'

export interface Props {
  deploy: () => void
  deployStatus?: deployment_state | null
  isInitializingDeploy?: boolean
  isDeployRequestRunning?: boolean
  disabled?: boolean
  cancel: () => void
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
    case deployment_state.finished:
    default:
      return {
        text: 'Run',
        icon: null,
      }
  }
}

function DeployButton({
  deploy,
  cancel,
  disabled,
  deployStatus,
  isDeployRequestRunning,
  isInitializingDeploy,
}: Props) {
  const representation = getDeploymentRepresentation(deployStatus, isInitializingDeploy)

  return (
    <>
      {/* {isDeployRequestRunning &&
        <Button
          onClick={cancel}
          variant={Button.variant.Outline}
          icon={<Ban size="16px" />}
        />
      } */}
      <Button
        isDisabled={isDeployRequestRunning || disabled}
        text={representation.text}
        onClick={deploy}
        variant={Button.variant.Full}
        icon={representation.icon}
      />
    </>
  )
}

export default memo(DeployButton)
