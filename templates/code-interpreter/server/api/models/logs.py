import datetime


from typing import Optional
from pydantic import BaseModel, StrictStr

from api.models.output import OutputType


class Stdout(BaseModel):
    type: OutputType = OutputType.STDOUT
    text: Optional[StrictStr] = None
    timestamp: Optional[datetime.datetime] = None


class Stderr(BaseModel):
    type: OutputType = OutputType.STDERR
    text: Optional[StrictStr] = None
    timestamp: Optional[datetime.datetime] = None
