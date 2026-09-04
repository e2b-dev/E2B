from e2b_code_interpreter.code_interpreter_sync import Sandbox

code = """
from IPython.display import display

display({'text/latex': r'\text{CustomReprObject}'}, raw=True)
"""


def test_bash(sandbox: Sandbox):
    execution = sandbox.run_code(code)
    assert execution.results[0].formats() == ["latex"]
