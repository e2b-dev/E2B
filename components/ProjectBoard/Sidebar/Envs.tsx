import { memo, useCallback } from 'react'

import Button from 'components/Button'
import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'

function Envs() {
  const store = useStateStore()

  const envs = store.use.envs()
  const setEnvs = store.use.setEnvs()
  const changeEnv = store.use.changeEnv()

  const handleEnvKeyChange = useCallback((event: any, idx: number) => {
    changeEnv({ key: event.target.value.trim(), value: envs[idx].value }, idx)
  }, [envs, changeEnv])

  const handleEnvValueChange = useCallback((event: any, idx: number) => {
    changeEnv({ key: envs[idx].key, value: event.target.value.trim() }, idx)
  }, [envs, changeEnv])

  const addNewEnv = useCallback(() => {
    setEnvs([...envs, { key: '', value: '' }])
  }, [envs, setEnvs])

  const deleteEnv = useCallback((delIdx: number) => {
    const newEnvs = [...envs.filter((_, idx) => idx !== delIdx)]
    setEnvs(newEnvs)
  }, [envs, setEnvs])

  return (
    <div className="
    max-w-full
    flex
    flex-col
    border-b
    p-4
    space-y-4
  ">
      <Text
        text="Envs"
        size={Text.size.S2}
        className="
        uppercase
        text-slate-400
        font-semibold
      "
      />
      {envs.map((env, idx) =>
        <div
          key={idx}
          className="
          flex
          items-center
          justify-evenly
          space-x-2
        "
        >
          <input
            className="
            flex-1
            p-1.5
            text-xs
            font-mono
            rounded
            border
            outline-none
            focus:border-green-800
            "
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            placeholder="KEY"
            value={env.key}
            onChange={event => handleEnvKeyChange(event, idx)}
          />
          <input
            className="
            flex-1
            p-1.5
            text-xs
            font-mono
            rounded
            border
            outline-none
            focus:border-green-800
          "
            placeholder="VALUE"
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            value={env.value}
            onChange={event => handleEnvValueChange(event, idx)}
          />
          {envs.length > 1 &&
            <Button
              text="Delete"
              onClick={() => deleteEnv(idx)}
            />
          }
        </div>
      )}
      <Button
        text="Add another"
        onClick={addNewEnv}
      />
    </div>
  )
}

export default memo(Envs)
