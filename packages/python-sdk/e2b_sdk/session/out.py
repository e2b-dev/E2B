from enum import Enum
from pydantic import BaseModel

class OutType(str, Enum):
    Stdout = "Stdout"
    Stderr = "Stderr"

class OutResponse(BaseModel):
    type: OutType
    # Unix epoch in nanoseconds
    timestamp: int
    line: str

class OutStdoutResponse(OutResponse):
    type: OutType = OutType.Stdout

class OutStderrResponse(OutResponse):
    type: OutType = OutType.Stderr
