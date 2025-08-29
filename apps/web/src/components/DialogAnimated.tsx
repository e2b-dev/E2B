import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import clsx from 'clsx'

export function DialogAnimated({
  open,
  setOpen,
  as = Fragment,
  className = '',
  afterLeave = () => {},
  rootProps = {},
  children,
}) {
  return (
    <Transition.Root show={open} as={as} afterLeave={afterLeave}>
      <Dialog
        onClose={setOpen}
        className={clsx('fixed inset-0 z-50', className)}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-zinc-400/25 backdrop-blur-sm dark:bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-20 md:py-32 lg:px-8 lg:py-[15vh]">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="mx-auto transform-gpu overflow-hidden rounded-lg bg-zinc-50 shadow-xl ring-1 ring-zinc-900/7.5 dark:bg-zinc-900 dark:ring-zinc-800 sm:max-w-xl">
              <div {...rootProps}>{children}</div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
