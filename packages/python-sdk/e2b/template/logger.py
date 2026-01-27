import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, TypedDict, Callable, Dict, Literal

from rich.console import Console
from rich.style import Style
from rich.text import Text

from e2b.template.utils import strip_ansi_escape_codes

"""Log entry severity levels."""
LogEntryLevel = Literal["debug", "info", "warn", "error"]


@dataclass
class LogEntry:
    """
    Represents a single log entry from the template build process.
    """

    timestamp: datetime
    level: LogEntryLevel
    message: str

    def __post_init__(self):
        self.message = strip_ansi_escape_codes(self.message)

    def __str__(self) -> str:
        return f"[{self.timestamp.isoformat()}] [{self.level}] {self.message}"


@dataclass
class LogEntryStart(LogEntry):
    """
    Special log entry indicating the start of a build process.
    """

    level: LogEntryLevel = field(default="debug", init=False)


@dataclass
class LogEntryEnd(LogEntry):
    """
    Special log entry indicating the end of a build process.
    """

    level: LogEntryLevel = field(default="debug", init=False)


"""
Interval in milliseconds for updating the build timer display.
"""
TIMER_UPDATE_INTERVAL_MS = 150

"""
Default minimum log level to display.
"""
DEFAULT_LEVEL: LogEntryLevel = "info"

"""
Colored labels for each log level.
"""
levels: Dict[LogEntryLevel, tuple[str, Style]] = {
    "error": ("ERROR", Style(color="red")),
    "warn": ("WARN ", Style(color="#FF4400")),
    "info": ("INFO ", Style(color="#FF8800")),
    "debug": ("DEBUG", Style(color="bright_black")),
}

"""
Numeric ordering of log levels for comparison (lower = less severe).
"""
level_order = {
    "debug": 0,
    "info": 1,
    "warn": 2,
    "error": 3,
}


def set_interval(func, interval):
    """
    Returns a stop function that can be called to cancel the interval.

    Similar to JavaScript's setInterval.

    :param func: Function to execute at each interval
    :param interval: Interval duration in **seconds**

    :return: Stop function that can be called to cancel the interval
    """
    stopped = threading.Event()

    def loop():
        while not stopped.is_set():
            if stopped.wait(interval):  # wait returns True if stopped
                break
            if not stopped.is_set():  # Double-check before executing
                func()

    threading.Thread(target=loop, daemon=True).start()
    return stopped.set  # Return the stop function


class DefaultBuildLoggerInitialState(TypedDict):
    start_time: float
    animation_frame: int
    timer: Optional[Callable[[], None]]


class DefaultBuildLogger:
    __console = Console()

    __min_level: LogEntryLevel
    __state: DefaultBuildLoggerInitialState

    def __init__(self, min_level: Optional[LogEntryLevel] = None):
        self.__min_level = min_level if min_level is not None else DEFAULT_LEVEL
        self.__reset_initial_state()

    def logger(self, log):
        if isinstance(log, LogEntryStart):
            self.__start_timer()
            return

        if isinstance(log, LogEntryEnd):
            if self.__state["timer"] is not None:
                self.__state["timer"]()
            return

        # Filter by minimum level
        if level_order[log.level] < level_order[self.__min_level]:
            return

        formatted_line = self.__format_log_line(log)
        self.__console.print(formatted_line)

        # Redraw the timer line
        self.__update_timer()

    def __reset_initial_state(self, timer: Optional[Callable[[], None]] = None):
        self.__state = {
            "start_time": time.time(),
            "animation_frame": 0,
            "timer": timer,
        }

    def __format_timer_line(self) -> str:
        elapsed_seconds = time.time() - self.__state["start_time"]
        return f"{elapsed_seconds:.1f}s"

    def __animate_status(self) -> str:
        frames = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"]
        idx = self.__state["animation_frame"] % len(frames)
        return frames[idx]

    def __format_log_line(self, line: LogEntry) -> Text:
        timer = self.__format_timer_line().ljust(5)
        timestamp = line.timestamp.strftime("%H:%M:%S")
        level_text, level_style = levels.get(line.level, levels[DEFAULT_LEVEL])

        # Build a rich Text object
        text = Text.assemble(
            timer,
            " | ",
            (timestamp, "dim"),
            " ",
            (level_text, level_style),
            " ",
            line.message,
        )

        return text

    def __start_timer(self):
        if not sys.stdout.isatty():
            return

        # Start the timer interval
        stop_timer = set_interval(
            self.__update_timer, TIMER_UPDATE_INTERVAL_MS / 1000.0
        )

        self.__reset_initial_state(stop_timer)

        # Initial timer display
        self.__update_timer()

    def __update_timer(self):
        if not sys.stdout.isatty():
            return

        self.__state["animation_frame"] += 1
        jumping_squares = self.__animate_status()

        timer_text = Text.assemble(
            jumping_squares, " Building ", self.__format_timer_line()
        )

        # Print with carriage return
        self.__console.print(timer_text, end="\r")


def default_build_logger(
    min_level: Optional[LogEntryLevel] = None,
) -> Callable[[LogEntry], None]:
    """
    Create a default build logger with animated timer display.

    :param min_level: Minimum log level to display (default: 'info')

    :return: Logger function that accepts LogEntry instances

    Example
    ```python
    from e2b import Template, default_build_logger

    template = Template().from_python_image()

    # Use with build - implementation would be in build_async module
    # await Template.build(template,
    #     alias='my-template',
    #     on_build_logs=default_build_logger(min_level='debug')
    # )
    ```
    """
    build_logger = DefaultBuildLogger(min_level)

    return build_logger.logger
