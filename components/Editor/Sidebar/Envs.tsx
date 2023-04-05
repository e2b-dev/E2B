import { memo, useCallback } from 'react'

import Button from 'components/Button'
import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'

function Envs() {
  const [selector] = useStateStore()

  const envs = selector.use.envs()
  const setEnvs = selector.use.setEnvs()
  const changeEnv = selector.use.changeEnv()

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
    flex
    flex-col
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
          text="Envs"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
            px-4
          "
        />
      </div>
      <div className="
      flex
      flex-col
      p-4
      space-y-4
      "
      >
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
    </div>
  )
}

export default memo(Envs)
