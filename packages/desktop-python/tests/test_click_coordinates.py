import pytest

from e2b import InvalidArgumentException

from e2b_desktop import Sandbox


class _FakeCommands:
    def __init__(self):
        self.ran = []

    def run(self, command, **kwargs):
        self.ran.append(command)

        class _Result:
            stdout = ""
            exit_code = 0

        return _Result()


def _sandbox_with_fake_commands():
    class _FakeSandbox(Sandbox):
        @property
        def commands(self):
            return self._fake_commands

    sandbox = _FakeSandbox.__new__(_FakeSandbox)
    sandbox._fake_commands = _FakeCommands()
    return sandbox, sandbox._fake_commands.ran


def test_click_at_an_origin_side_coordinate_moves_before_clicking():
    sandbox, ran = _sandbox_with_fake_commands()
    sandbox.left_click(0, 100)
    assert ran == ["xdotool mousemove --sync 0 100", "xdotool click 1"]


def test_click_without_coordinates_does_not_move():
    sandbox, ran = _sandbox_with_fake_commands()
    sandbox.left_click()
    assert ran == ["xdotool click 1"]


@pytest.mark.parametrize(
    "method,click_command",
    [
        ("left_click", "xdotool click 1"),
        ("double_click", "xdotool click --repeat 2 1"),
        ("right_click", "xdotool click 3"),
        ("middle_click", "xdotool click 2"),
    ],
)
def test_clicks_at_the_origin_move_to_it(method, click_command):
    sandbox, ran = _sandbox_with_fake_commands()
    getattr(sandbox, method)(0, 0)
    assert ran == ["xdotool mousemove --sync 0 0", click_command]


def test_single_coordinate_is_rejected():
    sandbox, ran = _sandbox_with_fake_commands()
    with pytest.raises(InvalidArgumentException):
        sandbox.left_click(5)
    with pytest.raises(InvalidArgumentException):
        sandbox.right_click(y=7)
    assert ran == []


def test_click_methods_expose_their_docstring():
    # `right_click` used to place its docstring after the validation raise,
    # which left `__doc__` as None.
    for method in (
        Sandbox.left_click,
        Sandbox.double_click,
        Sandbox.right_click,
        Sandbox.middle_click,
    ):
        assert method.__doc__ is not None
