import { describe, expect, test } from 'vitest'

import { asFormattedConfig, asFormattedTeam } from '../../src/utils/format'
import type { UserConfig } from '../../src/user'

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string) => text.replace(/\x1B\[[0-9;]*m/g, '')

const baseConfig: UserConfig = {
  version: 1,
  identity: {
    email: 'user@example.com',
  },
  oauth: {
    token_endpoint: 'https://hydra.example.com/oauth2/token',
    revoke_endpoint: 'https://hydra.example.com/oauth2/revoke',
    client_id: 'cli-client-id',
  },
  tokens: {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
  },
  last_refresh: '2026-07-22T12:00:00.000Z',
  teamName: 'Acme Project',
  teamId: 'a1b2c3d4',
  teamApiKey: 'e2b_' + '0'.repeat(40),
}

describe('asFormattedConfig', () => {
  test('prints the selected project name and ID', () => {
    const output = stripAnsi(asFormattedConfig(baseConfig))
    expect(output).toContain('Selected project: Acme Project (a1b2c3d4)')
    expect(output).not.toContain('team')
  })

  test('falls back to a project-worded hint when the name is missing', () => {
    const config = { ...baseConfig, teamName: '' }
    const output = stripAnsi(asFormattedConfig(config))
    expect(output).toContain('Log out and log in to get project name')
    expect(output).not.toContain('team')
  })
})

describe('asFormattedTeam', () => {
  const team = {
    name: 'Acme Project',
    teamID: 'a1b2c3d4',
    apiKey: 'e2b_' + '0'.repeat(40),
    isDefault: true,
  }

  test('marks the active entry as the currently selected project', () => {
    const output = stripAnsi(asFormattedTeam(team, 'a1b2c3d4'))
    expect(output).toContain('Acme Project (a1b2c3d4)')
    expect(output).toContain('(currently selected project)')
    expect(output).not.toContain('team')
  })

  test('leaves non-selected entries unmarked', () => {
    const output = stripAnsi(asFormattedTeam(team, 'other-id'))
    expect(output).toBe('Acme Project (a1b2c3d4)')
  })
})
