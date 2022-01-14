import { TRunner, BaseMessage } from './BaseMessage'

export const ErrorCodes = {
  Runner: {
    Internal: 'Runner/500',
    BadMessageFormat: 'Runner/400',
  },
  RunningEnvironment: {
    NotFound: 'RunningEnvironment/404',
  },
  Template: {
    NotFound: 'Template/404',
  },
}

export interface RunnerError extends BaseMessage {
  type: TRunner.Error
  payload: {
    code: string
    message: string
  }
}

interface ErrorFactory {
  internal: (msg: string, requestID?: string) => RunnerError
  badMessageFormat: (msg: string, requestID?: string) => RunnerError
  runningEnvironmentNotFound: (envID: string, requestID?: string) => RunnerError
  templateNotFound: (templateID: string, requestID?: string) => RunnerError
}

export const ErrorFactory: ErrorFactory = {
  internal: (message, requestID) => ({
    type: TRunner.Error,
    requestID,
    payload: {
      code: ErrorCodes.Runner.Internal,
      message,
    },
  }),

  badMessageFormat: (message, requestID) => ({
    type: TRunner.Error,
    requestID,
    payload: {
      code: ErrorCodes.Runner.BadMessageFormat,
      message,
    },
  }),

  runningEnvironmentNotFound: (envID, requestID) => ({
    type: TRunner.Error,
    requestID,
    payload: {
      code: ErrorCodes.RunningEnvironment.NotFound,
      runningEnvironmentID: envID,
      message: `Running environment with id "${envID}" not found`,
    },
  }),

  templateNotFound: (templateID, requestID) => ({
    type: TRunner.Error,
    requestID,
    payload: {
      code: ErrorCodes.Template.NotFound,
      templateID,
      message: `Template with id "${templateID}" not found in the available templates`,
    },
  }),
}
