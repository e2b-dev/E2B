import { deployment_state } from '@prisma/client'
import Button from 'components/Button'
import Spinner from 'components/Spinner'
import { capitalize } from 'utils/capitalize'

export interface Props {
  deploy: () => void
  deployStatus?: deployment_state | null
}

function isInProgress(deployStaus?: deployment_state | null) {
  switch (deployStaus) {
    case null:
    case deployment_state.generating:
    case deployment_state.deploying:
      return true
    default:
      return false
  }
}

function DeployButton({ deploy, deployStatus }: Props) {
  const inProgress = isInProgress()

  return (
    <Button
      text={deployStatus ? capitalize(deployStatus) : 'Deploy'}
      onClick={deploy}
      variant={Button.variant.Full}
      icon={inProgress ? <Spinner /> : null}
    />
  )
}

export default DeployButton
