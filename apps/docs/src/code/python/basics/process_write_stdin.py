from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # This example will print back the string we send to the process using `send_stdin()`

  proc = session.process.start(
      "while IFS= read -r line; do echo \"$line\"; sleep 1; done",
      on_stdout=print,
  )
  proc.send_stdin("AI Playground\n") # $HighlightLine
  proc.kill()

  session.close()

main()
