import { StarIcon } from 'lucide-react'
import Link from 'next/link'

function StarUs() {
  return (
    <Link
      href="https://github.com/e2b-dev/e2b"
      target="_blank"
      rel="noreferrer"
      className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-all"
    >
      <StarIcon size="14px" />
      <span>
        Star us on GitHub
      </span>
    </Link>
  )
}

export default StarUs
