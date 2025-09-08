export class GenericDockerRegistry {
  constructor(
    public readonly username: string,
    public readonly password: string
  ) {}

  toJSON() {
    return {
      type: 'registry' as const,
      username: this.username,
      password: this.password,
    }
  }
}

export class AWSRegistry {
  constructor(
    public readonly awsAccessKeyId: string,
    public readonly awsSecretAccessKey: string,
    public readonly awsRegion: string
  ) {}

  toJSON() {
    return {
      type: 'aws' as const,
      awsAccessKeyId: this.awsAccessKeyId,
      awsSecretAccessKey: this.awsSecretAccessKey,
      awsRegion: this.awsRegion,
    }
  }
}

export class GCPRegistry {
  constructor(public readonly serviceAccountJson: object | string) {}

  toJSON() {
    return {
      type: 'gcp' as const,
      serviceAccountJson:
        typeof this.serviceAccountJson === 'string'
          ? this.serviceAccountJson
          : JSON.stringify(this.serviceAccountJson),
    }
  }
}

export type RegistryConfig = GenericDockerRegistry | AWSRegistry | GCPRegistry
