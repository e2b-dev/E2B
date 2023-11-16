# Do something in the sandbox
sandbox.filesystem.write('hello.txt', 'Hello World!')

# Get the sandbox ID, we'll need it later
sandboxID = sandbox.id

# Keep the sandbox alive for 1 hour
sandbox.keep_alive(60 * 60)  # $HighlightLine

# Close the sandbox
sandbox.close()

# Do something else...
time.sleep(60)