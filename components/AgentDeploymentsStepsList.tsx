import {
  useEffect,
  useCallback,
  Fragment,
  useMemo,
} from 'react'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import { usePostHog } from 'posthog-js/react'

interface Step {
  type: string
  id: string
  message: string
  timestamp: string
  group?: {
    id: string
    message: string
  }
}

interface StepGroup {
  id?: string
  message?: string
  steps: Step[]
}

function groupSteps(steps: Step[]) {
  return steps.reduce<StepGroup[]>((acc, step) => {
    if (!step.group) {
      acc.push({
        steps: [step],
      })
    } else {
      const group = acc.find((g) => g.id === step.group?.id)
      if (group) {
        group.steps.push(step)
      } else {
        acc.push({
          id: step.group.id,
          message: step.group.message,
          steps: [step],
        })
      }
    }
    return acc
  }, [])
}


export interface Props {
  steps: Step[]
}

function AgentDeploymentStepsList({
  steps,
}: Props) {
  const router = useRouter()
  const selectedStepID = router.query.stepID as string
  const posthog = usePostHog()

  const selectStep = useCallback((id: string) => {
    posthog?.capture('selected log step', {
      stepID: id,
    })
    router.replace({
      pathname: '',
      query: {
        ...router.query,
        stepID: id,
      },
    }, undefined, { shallow: true })
  }, [router, posthog])

  useEffect(function selectDefaultStep() {
    if (selectedStepID) return

    const id = steps.length > 0 ? steps[0].id : undefined
    if (id) {
      selectStep(id)
    }
  }, [router, steps, selectedStepID, selectStep])

  const groupedSteps = useMemo(() => groupSteps(steps), [steps])

  return (
    <div className="flex flex-col ml-4 overflow-auto">
      {steps.length === 0 && (
        <div className="flex-1 flex items-center justify-center h-full">
          <p className="text-gray-400">No logs</p>
        </div>
      )}
      {groupedSteps.map((group, idx) => (
        <Fragment key={idx}>
          <div className={clsx({ 'border-gray-700 rounded-md py-4 my-3': group.id, 'border-transparent my-1': !group.id }, 'px-4 border relative')}>
            {group.id &&
              <span className="absolute top-[-9px] bg-gray-900 text-xs px-1.5 text-gray-50">
                {group.message}
              </span>
            }
            {group.steps.map((step, stepIdx) => (
              <Fragment key={stepIdx}>
                <div
                  className={clsx('flex items-center space-x-2 cursor-pointer group')}
                  onClick={() => selectStep(step.id)}
                >
                  <span className={clsx(
                    'font-bold text-sm capitalize min-w-[72px] group-hover:text-[#6366F1] transition-all',
                    selectedStepID === step.id && 'text-[#6366F1]',
                    selectedStepID !== step.id && 'text-[#55618C]',
                  )}
                  >
                    {step.type}
                  </span>
                  <span
                    className={clsx(
                      'text-sm text-gray-100 max-w-full truncate p-2 group-hover:bg-[#1F2437] transition-all rounded-md cursor-pointer w-full flex justify-between',
                      selectedStepID === step.id && 'bg-[#1F2437]',
                    )}
                  >
                    <span>
                      {step.message}
                    </span>
                    <span className="text-gray-600 text-sm self-center">
                      {new Date(step.timestamp + 'Z').toLocaleTimeString()}
                    </span>
                  </span>
                </div>
                {stepIdx !== group.steps.length - 1 && (
                  <div className="ml-1 rounded h-[24px] w-px bg-gray-800" />
                )}
              </Fragment>
            ))}
          </div>
          {idx !== groupedSteps.length - 1 && (
            <div className="ml-[21px] rounded h-[24px] w-px bg-gray-800" />
          )}
        </Fragment>
      ))}
    </div>
  )
}

export default AgentDeploymentStepsList
