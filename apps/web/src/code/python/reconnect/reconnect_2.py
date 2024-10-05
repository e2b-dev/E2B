# Do something in the sandbox
sandbox.filesystem.write('hello.txt', 'Hello World!')

# Get the sandbox ID, we'll need it later
sandboxID = sandbox.id

# Keep the sandbox alive for 2 minutes
sandbox.keep_alive(60 * 2)  # $HighlightLine

# Close the sandbox. Even if we close the sandbox, it will stay alive, because we explicitly called keep_alive().
sandbox.close()

# Do something else...
time.sleep(60)
