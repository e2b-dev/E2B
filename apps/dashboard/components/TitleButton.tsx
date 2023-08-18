import clsx from 'clsx'

import Text from 'components/Text'

export interface Props {
  onClick: () => void
  text: string
}

function TitleButton({ onClick, text }: Props) {
  return (
    <Text
      size={Text.size.S3}
      onClick={onClick}
      text={text}
      className={clsx(
        'whitespace-nowrap',
        'cursor-pointer',
        'transition-all',
        'text-slate-400 hover:text-green-800',
      )}
    />
  )
}

export default TitleButton
