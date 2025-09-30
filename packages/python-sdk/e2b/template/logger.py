import os
import threading
import time
from typing import Optional, TypedDict, Callable, Dict

from rich.console import Console
from rich.style import Style
from rich.text import Text

from e2b.template.types import LogEntryLevel, LogEntry, LogEntryStart, LogEntryEnd

TIMER_UPDATE_INTERVAL_MS = 150

DEFAULT_LEVEL: LogEntryLevel = "info"

# Level labels with Rich styles
levels: Dict[LogEntryLevel, tuple[str, Style]] = {
    "error": ("ERROR", Style(color="red")),
    "warn": ("WARN ", Style(color="#FF4400")),
    "info": ("INFO ", Style(color="#FF8800")),
    "debug": ("DEBUG", Style(color="bright_black")),
}

# Level ordering for comparison
level_order = {
    "error": 0,
    "warn": 1,
    "info": 2,
    "debug": 3,
}


class InitialState(TypedDict):
    start_time: float
    animation_frame: int
    timer: Optional[threading.Timer]


class BuildLogger:
    __console = Console()

    __min_level: LogEntryLevel
    __state: InitialState

    def __init__(self, min_level: Optional[LogEntryLevel] = None):
        self.__min_level = min_level if min_level is not None else DEFAULT_LEVEL
        self.__reset_initial_state()

    def logger(self, log):
        if isinstance(log, LogEntryStart):
            self.__start_timer()
            return

        if isinstance(log, LogEntryEnd):
            if self.__state["timer"] is not None:
                self.__state["timer"].cancel()
            return

        # Filter by minimum level
        if level_order[log.level] < level_order[self.__min_level]:
            return

        formatted_line = self.__format_log_line(log)
        self.__console.print(formatted_line)

        # Redraw the timer line
        self.__update_timer()

    def __reset_initial_state(self, timer: Optional[threading.Timer] = None):
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
        text = Text()
        text.append(timer)
        text.append(" | ")
        text.append(timestamp, style="dim")
        text.append(" ")
        text.append(level_text, style=level_style)
        text.append(" ")
        text.append(line.message)

        return text

    def __start_timer(self):
        if os.getenv("CI"):
            return

        # Start the timer interval
        timer = threading.Timer(TIMER_UPDATE_INTERVAL_MS / 1000.0, self.__update_timer)
        timer.start()

        self.__reset_initial_state(timer)

        # Initial timer display
        self.__update_timer()

    def __update_timer(self):
        if os.getenv("CI"):
            return

        self.__state["animation_frame"] += 1
        jumping_squares = self.__animate_status()

        timer_text = Text()
        timer_text.append(jumping_squares)
        timer_text.append(" Building ")
        timer_text.append(self.__format_timer_line())

        # Print with carriage return
        self.__console.print(timer_text, end="\r")


def default_build_logger(
    min_level: Optional[LogEntryLevel] = None,
) -> Callable[[LogEntry], None]:
    build_logger = BuildLogger(min_level)

    return build_logger.logger
