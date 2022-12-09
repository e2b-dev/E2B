import { Option } from 'commander'

export const idOption = new Option('-i, --id <id>', 'ID of the environment')

export const allOption = new Option(
  '-a, --all',
  'Invoke this command in all subdirectories recursively',
)

export const selectOption = new Option(
  '-s, --select',
  'Select environments from an interactive list',
)
