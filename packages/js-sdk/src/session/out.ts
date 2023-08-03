export enum OutType {
  Stdout = 'Stdout',
  Stderr = 'Stderr',
}

export interface OutResponse {
  type: OutType
  // Unix epoch in nanoseconds
  timestamp: number
  line: string
}

export interface OutStdoutResponse extends OutResponse {
  type: OutType.Stdout
}

export interface OutStderrResponse extends OutResponse {
  type: OutType.Stderr
}
