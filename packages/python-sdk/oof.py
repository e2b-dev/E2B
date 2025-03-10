from e2b import Sandbox

with Sandbox(auto_pause=True) as sandbox:
    sandbox.run_code("x = 1")
    execution = sandbox.run_code("x+=1; x")
    print(execution.text)  # outputs 2