import logging
import time
from re import search as re_search
from shlex import quote as quote_string
from typing import Callable, Dict, Iterator, Literal, Optional, overload, Tuple, Union
from uuid import uuid4

from e2b import (
    Sandbox as SandboxBase,
    CommandHandle,
    CommandResult,
    TimeoutException,
    CommandExitException,
    SandboxIamOpts,
    SandboxLifecycle,
    SandboxNetworkOpts,
    Volume,
)
from e2b.connection_config import ApiParams
from typing_extensions import Self, Unpack

MOUSE_BUTTONS = {"left": 1, "right": 3, "middle": 2}

KEYS = {
    "alt": "Alt_L",
    "alt_left": "Alt_L",
    "alt_right": "Alt_R",
    "backspace": "BackSpace",
    "break": "Pause",
    "caps_lock": "Caps_Lock",
    "cmd": "Super_L",
    "command": "Super_L",
    "control": "Control_L",
    "control_left": "Control_L",
    "control_right": "Control_R",
    "ctrl": "Control_L",
    "del": "Delete",
    "delete": "Delete",
    "down": "Down",
    "end": "End",
    "enter": "Return",
    "esc": "Escape",
    "escape": "Escape",
    "f1": "F1",
    "f2": "F2",
    "f3": "F3",
    "f4": "F4",
    "f5": "F5",
    "f6": "F6",
    "f7": "F7",
    "f8": "F8",
    "f9": "F9",
    "f10": "F10",
    "f11": "F11",
    "f12": "F12",
    "home": "Home",
    "insert": "Insert",
    "left": "Left",
    "menu": "Menu",
    "meta": "Meta_L",
    "num_lock": "Num_Lock",
    "page_down": "Page_Down",
    "page_up": "Page_Up",
    "pause": "Pause",
    "print": "Print",
    "right": "Right",
    "scroll_lock": "Scroll_Lock",
    "shift": "Shift_L",
    "shift_left": "Shift_L",
    "shift_right": "Shift_R",
    "space": "space",
    "super": "Super_L",
    "super_left": "Super_L",
    "super_right": "Super_R",
    "tab": "Tab",
    "up": "Up",
    "win": "Super_L",
    "windows": "Super_L",
}


def map_key(key: str) -> str:
    lower_key = key.lower()
    if lower_key in KEYS:
        return KEYS[lower_key]
    return lower_key


class _VNCServer:
    def __init__(self, desktop: "Sandbox") -> None:
        self.__novnc_handle: Optional[CommandHandle] = None

        self._vnc_port = 5900
        self._port = 6080
        self._novnc_auth_enabled = False
        self._novnc_password = None

        self._url = f"https://{desktop.get_host(self._port)}/vnc.html"

        self.__desktop = desktop

    def _wait_for_port(self, port: int) -> bool:
        return self.__desktop._wait_and_verify(
            f'netstat -tuln | grep ":{port} "', lambda r: r.stdout.strip() != ""
        )

    def _check_vnc_running(self) -> bool:
        try:
            self.__desktop.commands.run("pgrep -x x11vnc")
            return True
        except CommandExitException:
            return False

    @staticmethod
    def _generate_password(length: int = 16) -> str:
        import secrets
        import string

        characters = string.ascii_letters + string.digits
        return "".join(secrets.choice(characters) for _ in range(length))

    def get_url(
        self,
        auto_connect: bool = True,
        view_only: bool = False,
        resize: str = "scale",
        auth_key: Optional[str] = None,
    ) -> str:
        params = []
        if auto_connect:
            params.append("autoconnect=true")
        if view_only:
            params.append("view_only=true")
        if resize:
            params.append(f"resize={resize}")
        if auth_key:
            params.append(f"password={auth_key}")
        if params:
            return f"{self._url}?{'&'.join(params)}"
        return self._url

    def get_auth_key(self) -> str:
        if not self._novnc_password:
            raise RuntimeError(
                "Unable to retrieve stream auth key, check if require_auth is enabled"
            )
        return self._novnc_password

    def start(
        self,
        vnc_port: Optional[int] = None,
        port: Optional[int] = None,
        require_auth: bool = False,
        window_id: Optional[str] = None,
    ) -> None:
        # If stream is already running, throw an error
        if self._check_vnc_running():
            raise RuntimeError("Stream is already running")

        # Update parameters if provided
        self._vnc_port = vnc_port or self._vnc_port
        self._port = port or self._port
        self._novnc_auth_enabled = require_auth or self._novnc_auth_enabled
        self._novnc_password = self._generate_password() if require_auth else None

        # Update URL with new port
        self._url = f"https://{self.__desktop.get_host(self._port)}/vnc.html"

        # Set up VNC command
        pwd_flag = "-nopw"
        if self._novnc_auth_enabled:
            self.__desktop.commands.run("mkdir -p ~/.vnc")
            self.__desktop.commands.run(
                f"x11vnc -storepasswd {self._novnc_password} ~/.vnc/passwd"
            )
            pwd_flag = "-usepw"

        window_id_flag = ""
        if window_id:
            window_id_flag = f"-id {window_id}"

        vnc_command = (
            f"x11vnc -bg -display {self.__desktop._display} -forever -wait 50 -shared "
            f"-rfbport {self._vnc_port} {pwd_flag} 2>/tmp/x11vnc_stderr.log {window_id_flag}"
        )

        novnc_command = (
            f"cd /opt/noVNC/utils && ./novnc_proxy --vnc localhost:{self._vnc_port} "
            f"--listen {self._port} --web /opt/noVNC > /tmp/novnc.log 2>&1"
        )

        self.__desktop.commands.run(vnc_command)

        self.__novnc_handle = self.__desktop.commands.run(
            novnc_command, background=True, timeout=0
        )
        if not self._wait_for_port(self._port):
            raise TimeoutException("Could not start noVNC server")

    def stop(self) -> None:
        if self._check_vnc_running():
            self.__desktop.commands.run("pkill x11vnc")

        if self.__novnc_handle:
            self.__novnc_handle.kill()
            self.__novnc_handle = None


class Sandbox(SandboxBase):
    default_template = "desktop"
    __vnc_server: _VNCServer
    _last_xfce4_pid: Optional[str] = None
    _display: str

    @classmethod
    def create(
        cls,
        template: Optional[str] = None,
        resolution: Optional[Tuple[int, int]] = None,
        dpi: Optional[int] = None,
        display: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        secure: bool = True,
        allow_internet_access: bool = True,
        network: Optional[SandboxNetworkOpts] = None,
        iam: Optional[SandboxIamOpts] = None,
        lifecycle: Optional[SandboxLifecycle] = None,
        volume_mounts: Optional[Dict[str, Union[Volume, str]]] = None,
        logger: Optional[logging.Logger] = None,
        **opts: Unpack[ApiParams],
    ) -> Self:
        """
        Create a new sandbox.

        By default, the sandbox is created from the default `desktop` sandbox template.


        :param template: Sandbox template name or ID
        :param resolution: Startup the desktop with custom screen resolution. Defaults to (1024, 768)
        :param dpi: Startup the desktop with custom DPI. Defaults to 96
        :param display: Startup the desktop with custom display. Defaults to ":0"
        :param timeout: Timeout for the sandbox in **seconds**, default to 300 seconds. The maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.
        :param metadata: Custom metadata for the sandbox
        :param envs: Custom environment variables for the sandbox
        :param secure: Envd is secured with access token and cannot be used without it
        :param allow_internet_access: Allow sandbox to access the internet, defaults to `True`.

        :return: A Sandbox instance for the new sandbox

        Use this method instead of using the constructor to create a new sandbox.
        """

        # Initialize environment variables with DISPLAY
        display = display or ":0"
        if envs is None:
            envs = {}
        envs["DISPLAY"] = display

        sbx = super().create(
            template=template,
            timeout=timeout,
            metadata=metadata,
            envs=envs,
            secure=secure,
            allow_internet_access=allow_internet_access,
            network=network,
            iam=iam,
            lifecycle=lifecycle,
            volume_mounts=volume_mounts,
            logger=logger,
            **opts,
        )

        sbx._display = display
        width, height = resolution or (1024, 768)
        xvfb_handle = sbx.commands.run(
            f"Xvfb {display} -ac -screen 0 {width}x{height}x24"
            f" -retro -dpi {dpi or 96} -nolisten tcp -nolisten unix",
            background=True,
            timeout=0,
        )
        xvfb_handle.disconnect()

        if not sbx._wait_and_verify(
            f"xdpyinfo -display {display}", lambda r: r.exit_code == 0
        ):
            raise TimeoutException("Could not start Xvfb")

        sbx.__vnc_server = _VNCServer(sbx)
        sbx._start_xfce4()

        return sbx

    def _wait_and_verify(
        self,
        cmd: str,
        on_result: Callable[[CommandResult], bool],
        timeout: int = 10,
        interval: float = 0.5,
    ) -> bool:
        elapsed = 0
        while elapsed < timeout:
            try:
                if on_result(self.commands.run(cmd)):
                    return True
            except CommandExitException:
                continue

            time.sleep(interval)
            elapsed += interval

        return False

    def _start_xfce4(self):
        """
        Start xfce4 session if logged out or not running.
        """
        if self._last_xfce4_pid is None or "[xfce4-session] <defunct>" in (
            self.commands.run(
                f"ps aux | grep {self._last_xfce4_pid} | grep -v grep | head -n 1"
            ).stdout.strip()
        ):
            xfce4_handle = self.commands.run("startxfce4", background=True, timeout=0)
            self._last_xfce4_pid = xfce4_handle.pid
            xfce4_handle.disconnect()

    @property
    def stream(self) -> _VNCServer:
        return self.__vnc_server

    @overload
    def screenshot(self, format: Literal["stream"]) -> Iterator[bytes]:
        """
        Take a screenshot and return it as a stream of bytes.
        """

    @overload
    def screenshot(
        self,
        format: Literal["bytes"] = "bytes",
    ) -> bytearray:
        """
        Take a screenshot and return it as a bytearray.
        """

    def screenshot(
        self,
        format: Literal["bytes", "stream"] = "bytes",
    ):
        """
        Take a screenshot and return it in the specified format.

        :param format: The format of the screenshot. Can be 'bytes', 'blob', or 'stream'.
        :returns: The screenshot in the specified format.
        """
        screenshot_path = f"/tmp/screenshot-{uuid4()}.png"

        self.commands.run(f"scrot --pointer {screenshot_path}")

        file = self.files.read(screenshot_path, format=format)
        self.files.remove(screenshot_path)
        return file

    def left_click(self, x: Optional[int] = None, y: Optional[int] = None):
        """
        Left click on the mouse position.
        """
        if x and y:
            self.move_mouse(x, y)
        self.commands.run("xdotool click 1")

    def double_click(self, x: Optional[int] = None, y: Optional[int] = None):
        """
        Double left click on the mouse position.
        """
        if x and y:
            self.move_mouse(x, y)
        self.commands.run("xdotool click --repeat 2 1")

    def right_click(self, x: Optional[int] = None, y: Optional[int] = None):
        if (x is None) != (y is None):
            raise ValueError("Both x and y must be provided together")
        """
        Right click on the mouse position.
        """
        if x and y:
            self.move_mouse(x, y)
        self.commands.run("xdotool click 3")

    def middle_click(self, x: Optional[int] = None, y: Optional[int] = None):
        """
        Middle click on the mouse position.
        """
        if x and y:
            self.move_mouse(x, y)
        self.commands.run("xdotool click 2")

    def scroll(self, direction: Literal["up", "down"] = "down", amount: int = 1):
        """
        Scroll the mouse wheel by the given amount.

        :param direction: The direction to scroll. Can be "up" or "down".
        :param amount: The amount to scroll.
        """
        self.commands.run(
            f"xdotool click --repeat {amount} {'4' if direction == 'up' else '5'}"
        )

    def move_mouse(self, x: int, y: int):
        """
        Move the mouse to the given coordinates.

        :param x: The x coordinate.
        :param y: The y coordinate.
        """
        self.commands.run(f"xdotool mousemove --sync {x} {y}")

    def mouse_press(self, button: Literal["left", "right", "middle"] = "left"):
        """
        Press the mouse button.
        """
        self.commands.run(f"xdotool mousedown {MOUSE_BUTTONS[button]}")

    def mouse_release(self, button: Literal["left", "right", "middle"] = "left"):
        """
        Release the mouse button.
        """
        self.commands.run(f"xdotool mouseup {MOUSE_BUTTONS[button]}")

    def get_cursor_position(self) -> tuple[int, int]:
        """
        Get the current cursor position.

        :return: A tuple with the x and y coordinates
        :raises RuntimeError: If the cursor position cannot be determined
        """
        result = self.commands.run("xdotool getmouselocation")

        groups = re_search(r"x:(\d+)\s+y:(\d+)", result.stdout)
        if not groups:
            raise RuntimeError(
                f"Failed to parse cursor position from output: {result.stdout}"
            )

        x, y = groups.group(1), groups.group(2)
        if not x or not y:
            raise RuntimeError(f"Invalid cursor position values: x={x}, y={y}")

        return int(x), int(y)

    def get_screen_size(self) -> tuple[int, int]:
        """
        Get the current screen size.

        :return: A tuple with the width and height
        :raises RuntimeError: If the screen size cannot be determined
        """
        result = self.commands.run("xrandr")

        _match = re_search(r"(\d+x\d+)", result.stdout)
        if not _match:
            raise RuntimeError(
                f"Failed to parse screen size from output: {result.stdout}"
            )

        try:
            return tuple(map(int, _match.group(1).split("x")))  # type: ignore
        except (ValueError, IndexError) as e:
            raise RuntimeError(f"Invalid screen size format: {_match.group(1)}") from e

    def write(self, text: str, *, chunk_size: int = 25, delay_in_ms: int = 75) -> None:
        """
        Write the given text at the current cursor position.

        :param text: The text to write.
        :param chunk_size: The size of each chunk of text to write.
        :param delay_in_ms: The delay between each chunk of text.
        """

        def break_into_chunks(text: str, n: int):
            for i in range(0, len(text), n):
                yield text[i : i + n]

        for chunk in break_into_chunks(text, chunk_size):
            self.commands.run(
                f"xdotool type --delay {delay_in_ms} -- {quote_string(chunk)}"
            )

    def press(self, key: Union[str, list[str]]):
        """
        Press a key.

        :param key: The key to press (e.g. "enter", "space", "backspace", etc.).
        """
        if isinstance(key, list):
            key = "+".join(map_key(k) for k in key)
        else:
            key = map_key(key)

        self.commands.run(f"xdotool key {key}")

    def drag(self, fr: tuple[int, int], to: tuple[int, int]):
        """
        Drag the mouse from the given position to the given position.

        :param from: The starting position.
        :param to: The ending position.
        """
        self.move_mouse(fr[0], fr[1])
        self.mouse_press()
        self.move_mouse(to[0], to[1])
        self.mouse_release()

    def wait(self, ms: int):
        """
        Wait for the given amount of time.

        :param ms: The amount of time to wait in milliseconds.
        """
        self.commands.run(f"sleep {ms / 1000}")

    def open(self, file_or_url: str):
        """
        Open a file or a URL in the default application.

        :param file_or_url: The file or URL to open.
        """
        handle = self.commands.run(f"xdg-open {file_or_url}", background=True)
        handle.disconnect()

    def get_current_window_id(self) -> str:
        """
        Get the current window ID.
        """
        return self.commands.run("xdotool getwindowfocus").stdout.strip()

    def get_application_windows(self, application: str) -> list[str]:
        """
        Get the window IDs of all windows for the given application.
        """
        return (
            self.commands.run(f"xdotool search --onlyvisible --class {application}")
            .stdout.strip()
            .split("\n")
        )

    def get_window_title(self, window_id: str) -> str:
        """
        Get the title of the window with the given ID.
        """
        return self.commands.run(f"xdotool getwindowname {window_id}").stdout.strip()

    def launch(self, application: str, uri: Optional[str] = None):
        """
        Launch an application.
        """
        handle = self.commands.run(
            f"gtk-launch {application} {uri or ''}", background=True, timeout=0
        )
        handle.disconnect()
