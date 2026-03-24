# Reconnect to the sandbox
sandbox2 = Sandbox.reconnect(sandboxID) # $HighlightLine

# Continue in using the sandbox
content = sandbox2.filesystem.read('hello.txt')
print(content)

# Close the sandbox
sandbox2.close()
