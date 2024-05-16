'use client'

import { BentoCard, BentoGrid } from '@/components/BentoGrid'
import { Button } from '@/components/Button'
import RetroGrid from '@/components/RetroGrid'

export default function Page() {
  return (
    <div className="flex flex-col w-full h-full">
      
      {/* Hero */}
      <div className="w-full h-screen flex justify-center items-center">
        
        <div className="flex flex-col z-10 space-y-5 items-center justify-center">
          <Button variant='outline'>We&apos;re hiring 👉</Button>
          <h1 className="font-bold p-2 text-6xl bg-clip-text text-transparent bg-gradient-to-r from-white to-orange-500 via-white to-[95%]">Code Interpreting for AI Apps</h1>
          <div className='flex space-x-4'>
            <Button variant='filled'>Sign Up</Button>
            <Button>Docs</Button>
          </div>
        </div>

        <RetroGrid />
      </div>

      {/* Features section  */}
      <div className="w-full h-screen flex flex-col items-center bg-gradient-to-b to-90% from-black/50 to-transparent">
      <h1 className="font-bold pb-10 text-4xl">
        Try the Python & JS/TS SDKs
      </h1>
        <BentoGrid className="w-2/3 flex flex-col space-y-10 pb-10">
          <BentoCard
            name="Step 1"
            description="Install the Code Interpreter SDK"
            href="/"
            cta="Learn more"
            Icon={LockIcon}
            className="col-span-3 lg:col-span-1 "
            background={<Background />}
          />
          <BentoCard
            name="Step 2"
            description="Execute AI-generated code"
            href="/"
            cta="Learn more"
            Icon={LockIcon}
            className="col-span-3 lg:col-span-1"
            background={<Background />}
          />
        </BentoGrid>
        <Button variant='filled'>Get Started</Button> 
      </div>
    
    </div>
  )
}

const LockIcon = () => <span className="text-neutral-400">1️⃣</span>

const Background = () => (
  <div className="w-full h-full flex flex-col items-center justify-center">
    <div className='flex m-2 border rounded-lg flex-col items-center justify-center'>
      {/* <code className="text-neutral-400 text-sm">
        {"import { CodeInterpreter } from '@e2b/code-interpreter'\nconst sandbox = await CodeInterpreter.create()\nawait sandbox.notebook.execCell(x = 1)"}
      </code> */}
    </div>
  </div>
)

