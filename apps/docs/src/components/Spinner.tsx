import { Loader2 as Loader } from 'lucide-react'

// export interface Props {
//   className?: string
// }

function Spinner({ className = '' }) {
  return (
    <Loader
      className={`animate-spin ${className ? className : ''}`}
      size="16px"
    />
  )
}

export default Spinner

// TODO: Nicer loading dots, I don't like these much
export function LoadingDots() {
  return (
    <div className="inline-flex align-middle">
      <span className="circle animate-loaderDots"></span>
      <span className="circle animation-delay-200 animate-loaderDots"></span>
      <span className="circle animation-delay-400 animate-loaderDots"></span>
    </div>
  )
}
