from e2b import Sandbox

sbx = Sandbox(debug=True)

print(sbx.is_running())

res = sbx.files.list("/")
print(res)

# sbx.files.write("/tmp/test.txt", "Hello World")
# print(sbx.files.read("/tmp/test.txt"))
