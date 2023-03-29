import ContextAutocomplete from 'components/Editor/extensions/ContextAutocomplete'

import { Command } from './command'

const ContextAutocompleteName = 'contextAutocomplete'

export default Command(ContextAutocomplete)
  .extend({
    name: ContextAutocompleteName,
  })
  .configure({
    suggestion: {
      startOfLine: false,
    },
  })
