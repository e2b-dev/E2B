import { Node } from '@tiptap/core'

export default Node.create({
  addKeyboardShortcuts() {
    return {
      // Override default browser Ctrl/Cmd+S shortcut.
      'Mod-s': function () {
        return true
      },
    }
  }
})
