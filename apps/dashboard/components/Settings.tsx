import APIKey from './Settings/APIKey'


export interface Props {
  apiKey: string
}

function Settings({ apiKey }: Props) {
  return (
    <main className="overflow-hidden flex flex-col max-h-full flex-1 rounded-md">
      <header className="flex items-center px-4 py-3 border-b border-b-white/5 justify-between">
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
        </div>
      </header>
      <div className="space-x-4 overflow-hidden m-4">
        <div className="text-xl font-semibold text-white">API key</div>
        <APIKey apiKey={apiKey} />
      </div>
    </main>
  )
}

export default Settings
