import io
import asyncio

from e2b import Sandbox

sbx = Sandbox(debug=True)

print(sbx.sandbox_id)

f = sbx.files.list("/")
print(f)

# const res = await sbx.commands.run('while true; do echo -n "Hello World"; sleep 1; done', {
#   // requestTimeoutMs: 1,
#   onStdout: (data) => {
#     // TODO: print also the time elapsed
#     console.log(`${(Date.now() - start) / 1000}s: ${data}`)
#   },
# })


# input = io.StringIO("This goes into the read buffer.")

# s.files.write("/tmp/test.txt", input)


sbx.commands.run(
    cmd='while true; do echo -n "Hello World"; sleep 1; done',
    on_stdout=lambda x: print(x),
)
