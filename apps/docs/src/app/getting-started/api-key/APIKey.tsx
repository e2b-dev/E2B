import { Button } from '@/components/Button'
import { useApiKey, useUser } from '@/utils/useUser'

function APIKey() {
  const { user, isLoading, error } = useUser()
  const apiKey = useApiKey()

  return (
    <div className="flex flex-col min-[540px]:flex-row items-center gap-4">
      You can get your API key by signing up.
      {/* @ts-ignore */}
      <Button children="Sign up to get your API key" />
    </div>
  )
}

export default APIKey