import { Loader2 as Loader } from 'lucide-react'

function Spinner({ className = '' }) {
  return (
    <Loader
      className={`animate-spin ${className ? className : ''}`}
      size="16px"
    />
  )
}

export default Spinner
