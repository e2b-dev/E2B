from typing import Optional
from pydantic import BaseModel, StrictStr
from pydantic import Field

from api.models.output import OutputType


class Error(BaseModel):
    type: OutputType = OutputType.ERROR

    name: Optional[StrictStr] = Field(default=None, description="Name of the exception")
    value: Optional[StrictStr] = Field(
        default=None, description="Value of the exception"
    )
    traceback: Optional[StrictStr] = Field(
        default=None, description="Traceback of the exception"
    )
