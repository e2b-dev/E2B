import SpinnerIcon from 'components/Spinner'

export function PageLoader() {
  return <div className="h-full flex flex-col items-center justify-center bg-gray-800 py-8 px-6 space-y-8">
    <SpinnerIcon className="text-gray-400" />
  </div>
}