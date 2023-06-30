import Instructions from './Instructions'
import useInstructions from './useInstructions'
import Repo from './Repo'

function StripeCheckoutTemplate() {
  const {
    Description,
    RepoURL,
    setDescription,
    setRepoURL
  } = useInstructions()

  return (
    <>
      <Repo
        repoUrl={RepoURL}
        setRepoUrl={setRepoURL}
      />
      <Instructions
        description={Description}
        setDescription={setDescription}
      />
    </>
  )
}

export default StripeCheckoutTemplate
