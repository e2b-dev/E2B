export interface Props {
  openAIKey?: string
  onOpenAIKeyChange: (e: any) => void
  models: { displayName: string, value: string }[]
  selectedModel: { displayName: string, value: string }
  onModelChange: (value: string) => void
}

function OpenAIKeyInput({
  openAIKey,
  onOpenAIKeyChange,
  models,
  selectedModel,
  onModelChange,
}: Props) {
  return (
    <div className="flex-1 flex flex-col space-y-2">
      <div className="flex-1 flex flex-col space-y-1">
        <label htmlFor="openai-model" className="block text-sm font-medium text-gray-400">
          Model
        </label>
        <select
            id="openai-model"
            name="location"
            className="cursor-pointer bg-gray-800 block w-full rounded-md px-3 py-1.5 text-gray-100 border border-gray-400 placeholder:text-gray-400 focus:border-gray-300 active:border-gray-300 outline-none sm:text-sm sm:leading-6 transition-all"
            value={selectedModel?.value}
            onChange={e => onModelChange(e.target.value)}
          >
            {models.map(model => (
              <option key={model.value} value={model.value}>
                {model.displayName}
              </option>
            ))}
        </select>
      </div>

      <div className="flex-1 flex flex-col space-y-1">
        <label htmlFor="openai-key" className="block text-sm font-medium text-gray-400">
          OpenAI Key
        </label>
        <input
          id="openai-key"
          className="bg-gray-800 block w-full rounded-md px-3 py-1.5 text-gray-100 border border-gray-400 placeholder:text-gray-400 focus:border-gray-300 outline-none sm:text-sm sm:leading-6 transition-all security"
          placeholder="OpenAI API Key"
          value={openAIKey}
          onChange={onOpenAIKeyChange}
          autoFocus
        />
      </div>
    </div>
  )
}

export default OpenAIKeyInput