from pydantic import BaseModel, StrictStr
from pydantic import Field


class Context(BaseModel):
    id: StrictStr = Field(description="Context ID")
    language: StrictStr = Field(description="Language of the context")
    cwd: StrictStr = Field(description="Current working directory of the context")

    def __hash__(self):
        return hash(self.id)
