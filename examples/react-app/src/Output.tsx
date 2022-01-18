export interface Props {
  stdout?: string[]
  stderr?: string[]
}

function Output({
  stdout,
  stderr,
}: Props) {

  return (
    <div
      className="output"
    >
      <div className="header">Output</div>

      {stdout && stdout.map((out, idx) => (
        <span key={`out_${idx}`}>{out}</span>
      ))}
      {stderr && stderr.map((out, idx) => (
        <span className="error" key={`out_${idx}`}>{out}</span>
      ))}
    </div>
  )
}


export default Output;
