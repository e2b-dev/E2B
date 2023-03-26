import SlashCommand from 'components/Editor/extensions/SlashCommand'

import { Command } from './command'

const SlashCommandName = 'slashCommand'

export default Command(SlashCommand)
  .extend({
    name: SlashCommandName,
  })
  .configure({
    suggestion: {
      char: '/',
      startOfLine: false,
    },
  })
