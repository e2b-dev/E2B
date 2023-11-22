from e2b import Sandbox

sandbox = Sandbox(template="base")

# File bytes will read file's content as bytes
# `file_bytes` as a bytearray
file_bytes = sandbox.filesystem.read_bytes("/etc/hosts")  # $HighlightLine

# The output will look similar to this:
# b'127.0.0.1\tlocalhost\n::1\tlocalhost ip6-localhost ip6-loopback\nfe00::0\tip6-localnet\nff00::0\tip6-mcastprefix\nff02::1\tip6-allnodes\nff02::2\tip6-allrouters\n172.17.0.17\t77c7a543226b\n'
print(file_bytes)

# We can save those bytes to a file locally like this:
with open("./hosts.txt", "wb") as f:
    f.write(file_bytes)

sandbox.close()
