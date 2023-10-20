import time
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

# List of ports that have already been printed
printed_ports = []

# The logs will look similar to this:
# ip='0.0.0.0'      port=49982  state='LISTEN'      https://49982-smob7j0j-fce131d5.ondevbook.com
# ip='0.0.0.0'      port=22     state='LISTEN'      https://22-smob7j0j-fce131d5.ondevbook.com
# ip='169.254.0.21' port=49982  state='ESTABLISHED' https://49982-smob7j0j-fce131d5.ondevbook.com
# ip='127.0.0.53'   port=53     state='LISTEN'      https://53-smob7j0j-fce131d5.ondevbook.com
# ip='0.0.0.0'      port=8000   state='LISTEN'      https://8000-smob7j0j-fce131d5.ondevbook.com
def print_new_port_and_url(open_ports, session):
  for port in open_ports:
    if port not in printed_ports:
      printed_ports.append(port)

      host = session.get_hostname(port.port)
      port_url = f"https://{host}"
      print(port, port_url)

def main():
  session = Session.create(
    id="Python3",
    api_key=E2B_API_KEY,
    on_scan_ports=lambda open_ports: print_new_port_and_url(open_ports, session) # $HighlightLine
  )

  # Start a new server on port 8000 inside the playground.
  proc = session.process.start("python3 -m http.server 8000")

  # Wait 10 seconds and then kill the server and close the session.
  time.sleep(10)
  proc.kill()
  session.close()

main()
