from e2b import Session
# You can use some of the predefined environments by using specific id:
# 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
session = Session(id="Nodejs", on_scan_ports=lambda ports: print("Open ports", ports))

# Start a session and create a connection to it
await session.open()

...

# Close the session after you are done
await session.close()