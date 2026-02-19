from enum import Enum


class LogsSource(str, Enum):
    PERSISTENT = "persistent"
    TEMPORARY = "temporary"

    def __str__(self) -> str:
        return str(self.value)
