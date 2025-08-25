export type Instructions = {
  type: 'COPY' | 'ENV' | 'RUN' | 'WORKDIR' | 'USER'
  args: string[]
  force: boolean
  forceUpload?: boolean
}

export type Steps = Instructions & {
  filesHash?: string
}

export type Duration = `${number}s` | `${number}m` | `${number}h` | `${number}d`
