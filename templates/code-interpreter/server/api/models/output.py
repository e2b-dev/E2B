from __future__ import annotations

from enum import Enum
from pydantic import BaseModel


class OutputType(Enum):
    """
    Represents the type of the data to send to the client.
    """

    STDOUT = "stdout"
    STDERR = "stderr"
    RESULT = "result"
    ERROR = "error"
    NUMBER_OF_EXECUTIONS = "number_of_executions"
    END_OF_EXECUTION = "end_of_execution"
    UNEXPECTED_END_OF_EXECUTION = "unexpected_end_of_execution"


class EndOfExecution(BaseModel):
    type: OutputType = OutputType.END_OF_EXECUTION


class UnexpectedEndOfExecution(BaseModel):
    type: OutputType = OutputType.UNEXPECTED_END_OF_EXECUTION


class NumberOfExecutions(BaseModel):
    type: OutputType = OutputType.NUMBER_OF_EXECUTIONS
    execution_count: int
