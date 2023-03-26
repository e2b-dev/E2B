export const destroyOnEsc = {
  name: 'destroyOnEsc',

  defaultValue: true,

  fn({ destroy }: { destroy: () => void }) {
    function onKeyDown(event: any) {
      if (event.keyCode === 27) destroy()
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