import Splitter from '@devbookhq/splitter'

function AgentRun() {
  return (
    <main className="overflow-hidden flex flex-col flex-1">
      <header className="flex items-center justify-between pt-4 px-4 sm:pt-8 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold leading-7 text-white">Run Detail [TODO: name]</h1>
      </header>

      <div className="flex-1 flex items-start justify-start sm:p-6 lg:px-8">
        <Splitter
          draggerClassName="bg-gray-700 group-hover:bg-[#F163A7] transition-all delay-75 duration-[400ms] w-0.5 h-12"
          gutterClassName="bg-transparent hover:bg-[#F163A7] transition-all delay-75 duration-[400ms] px-0.5 mx-0.5 rounded-md group"
          classes={['flex', 'flex']}
        >
          <div className="self-stretch bg-[#1F2437] border border-gray-700 rounded-md flex-1">Prompt</div>
          <div className="self-stretch flex-1">Steps</div>
        </Splitter>
      </div>
    </main>
  )
}

export default AgentRun
