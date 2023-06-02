import { GitHubAccount } from 'utils/github'

export enum ActionType {
  Initial,
  SelectAccount,
  UpdateName,
  Create,
  Fail,
  Success,
  RequestPermissions,
  SelectRepo,
}

export interface Create {
  type: ActionType.Create
  payload: {}
}

export interface Success {
  type: ActionType.Success
  payload: {}
}

export interface SelectAccount {
  type: ActionType.SelectAccount
  payload: {
    account: GitHubAccount
  }
}

export interface UpdateName {
  type: ActionType.UpdateName
  payload: {
    name: string
  }
}

export interface Fail {
  type: ActionType.Fail
  payload: {
    error: Error
  }
}

export interface RequestPermissions {
  type: ActionType.RequestPermissions
  payload: {}
}

export interface SelectRepo {
  type: ActionType.SelectRepo;
  payload: {
    repo: any
  }
}

export type Action = Create |
  Success |
  UpdateName |
  SelectAccount |
  Fail |
  RequestPermissions |
  SelectRepo

export interface State {
  name: string
  account: GitHubAccount | null
  isCreating: boolean
  error?: Error
  // TODO: Maybe pass the whole repo?
  selectedRepo?: number
  requiresPermissions: boolean
}

export function creationReducer(state: State, action: Action) {
  const { type, payload } = action
  switch (type) {
    case ActionType.Create:
      return {
        ...state,
        isCreating: true,
        error: undefined,
      }
    case ActionType.Success:
      return {
        ...state,
        isCreating: false,
      }
    case ActionType.Fail:
      return {
        ...state,
        error: payload.error,
        isCreating: false,
      }
    case ActionType.UpdateName:
      return {
        ...state,
        name: payload.name,
      }
    case ActionType.SelectAccount:
      return {
        ...state,
        account: payload.account,
      }
    case ActionType.RequestPermissions:
      return {
        ...state,
        requiresPermissions: true,
      }
    case ActionType.SelectRepo:
      return {
        ...state,
        // TODO: Maybe pass the whole repo?
        selectedRepo: payload.repo,
      }
    default:
      return state
  }
}
