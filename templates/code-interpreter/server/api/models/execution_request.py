from typing import Optional
from pydantic import BaseModel, StrictStr
from pydantic import Field

from .env_vars import EnvVars


class ExecutionRequest(BaseModel):
    code: StrictStr = Field(description="Code to be executed")
    context_id: Optional[StrictStr] = Field(default=None, description="Context ID")
    language: Optional[StrictStr] = Field(
        default=None, description="Language of the code"
    )
    env_vars: Optional[EnvVars] = Field(
        description="Environment variables", default=None
    )
