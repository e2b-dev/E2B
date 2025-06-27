from e2b.sandbox.commands.command_handle import CommandExitException

import pytest

from e2b import Sandbox


class Desktop(Sandbox):
    default_template = "desktop"

    @staticmethod
    def _wrap_pyautogui_code(code: str):
        return f"""
import pyautogui
import os
import Xlib.display

display = Xlib.display.Display(os.environ["DISPLAY"])
pyautogui._pyautogui_x11._display = display

{code}
exit(0)
"""

    def pyautogui(self, pyautogui_code: str):
        code_path = "/home/user/code-4f3a0850-1a83-47b2-8402-67b039a084ae.py"
        print(code_path)

        code = self._wrap_pyautogui_code(pyautogui_code)

        self.files.write(code_path, code)

        self.commands.run(f"python {code_path}")


@pytest.mark.skip
def test_envelope_decode():
    with Desktop(timeout=30) as desktop:
        for _ in range(10):
            with pytest.raises(CommandExitException):
                desktop.pyautogui(
                    """
pyautogui.write("Hello, ")
"""
                )
