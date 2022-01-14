
export interface Props {
  children?: string
}

function Devbook({ children }: Props) {

  return (
    <div>
      {children}
    </div>
  )
}

export default Devbook
