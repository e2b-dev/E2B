export const destroyOnBackspace = {
  name: 'destroyOnBackspace',

  defaultValue: true,

  fn({ destroy }: { destroy: () => void }) {
    function onKeyDown(event: any) {
      if (event.key === 'Backspace') destroy()
    }

    return {
      onShow() {
        document.addEventListener('keydown', onKeyDown)
      },
      onHide() {
        document.removeEventListener('keydown', onKeyDown)
      },
    }
  },
}