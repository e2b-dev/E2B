import * as commander from 'commander'

export const envPathArgument = new commander.Argument(
  '[envPath]',
  'Path to the environment directory. If it is not specified the current directory will be used',
)
