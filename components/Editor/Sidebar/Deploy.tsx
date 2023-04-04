import { deployments } from '@prisma/client'
import Text from 'components/Text'
import Link from 'next/link'

export interface Props {
  deployment?: deployments
}

function Deploy({
  deployment,
}: Props) {

  return (
    <div className="
      flex
      flex-col
      overflow-hidden
      ">
      <div className="
        flex
        bg-slate-50
        items-center
        justify-between
        border-b
        py-3.5
        pr-4
      ">
        <Text
          text="Deploy"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
            px-4
          "
        />
      </div>
      <div
        className="
        flex
        flex-1
        space-y-2
        p-4
        flex-col
      "
      >
        <Text
          text="Latest Deployment"
          className="
          font-semibold
          uppercase
          text-slate-400
        "
          size={Text.size.S3}
        />
        {deployment?.url &&
          <Link
            href={deployment.url}
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text
              size={Text.size.S3}
              text={deployment.url.substring('https://'.length)}
            />
          </Link>
        }
        {!deployment?.url &&
          <Text
            text="No deployment URL found"
            size={Text.size.S3}
            className="text-slate-400"
          />
        }
      </div>
    </div>
  )
}

export default Deploy
