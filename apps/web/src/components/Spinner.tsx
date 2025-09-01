import { Loader2 as Loader } from 'lucide-react'

function Spinner({ className = '', size = '16px' }) {
  return (
    <Loader
      className={`animate-spin ${className ? className : ''}`}
      size={size}
    />
  )
}

export default Spinner
