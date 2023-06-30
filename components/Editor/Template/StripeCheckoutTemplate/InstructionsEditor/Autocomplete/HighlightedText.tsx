import React from 'react'
import Fuse from 'fuse.js'

export interface Props {
  text: string
  ranges?: ReadonlyArray<Fuse.RangeTuple>
}

function HighlightedText({ text, ranges }: Props) {
  const indices = ranges?.reduce<number[]>((acc, [start, end]) => {
    for (let i = start; i <= end; i++) {
      acc.push(i)
    }
    return acc
  }, [])

  return (
    <div>
      {text.split('').map((char, index) => (
        <span
          key={index}
          className={indices?.includes(index) ? 'match' : ''}
        >
          {char}
        </span>
      ))}
    </div>
  )
}

export default HighlightedText
