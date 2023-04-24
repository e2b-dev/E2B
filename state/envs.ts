export interface EnvVar {
  key: string
  value: string
}

export function getDefaultEnv(): EnvVar {
  return { key: '', value: '' }
}
