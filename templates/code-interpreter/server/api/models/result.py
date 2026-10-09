from __future__ import annotations

import warnings

from typing import Optional, Iterable
from pydantic import BaseModel

from api.models.output import OutputType

warnings.filterwarnings("ignore", category=UserWarning)


class Result(BaseModel):
    """
    Represents the data to be displayed as a result of executing a cell in a Jupyter notebook.
    The result is similar to the structure returned by ipython kernel: https://ipython.readthedocs.io/en/stable/development/execution.html#execution-semantics

    The result can contain multiple types of data, such as text, images, plots, etc. Each type of data is represented
    as a string, and the result can contain multiple types of data. The display calls don't have to have text representation,
    for the actual result the representation is always present for the result, the other representations are always optional.
    """

    type: OutputType = OutputType.RESULT

    text: Optional[str] = None
    html: Optional[str] = None
    markdown: Optional[str] = None
    svg: Optional[str] = None
    png: Optional[str] = None
    jpeg: Optional[str] = None
    pdf: Optional[str] = None
    latex: Optional[str] = None
    json: Optional[dict] = None
    javascript: Optional[str] = None
    data: Optional[dict] = None
    chart: Optional[dict] = None
    extra: Optional[dict] = None
    "Extra data that can be included. Not part of the standard types."

    is_main_result: Optional[bool] = None
    "Whether this data is the result of the execetution. Data can be produced by display calls of which can be multiple in a cell."

    def __init__(self, is_main_result: bool, data: [str, str]):
        super().__init__()
        self.is_main_result = is_main_result

        self.text = data.pop("text/plain", None)
        if self.text and (
            (self.text.startswith("'") and self.text.endswith("'"))
            or (self.text.startswith('"') and self.text.endswith('"'))
        ):
            self.text = self.text[1:-1]

        self.html = data.pop("text/html", None)
        self.markdown = data.pop("text/markdown", None)
        self.svg = data.pop("image/svg+xml", None)
        self.png = data.pop("image/png", None)
        self.jpeg = data.pop("image/jpeg", None)
        self.pdf = data.pop("application/pdf", None)
        self.latex = data.pop("text/latex", None)
        self.json = data.pop("application/json", None)
        self.javascript = data.pop("application/javascript", None)
        self.data = data.pop("e2b/data", None)
        self.chart = data.pop("e2b/chart", None)
        self.extra = data

    def formats(self) -> Iterable[str]:
        formats = []

        for key in [
            "text",
            "html",
            "markdown",
            "svg",
            "png",
            "jpeg",
            "pdf",
            "latex",
            "json",
            "javascript",
            "data",
            "chart",
        ]:
            if getattr(self, key):
                formats.append(key)

        if self.extra:
            for key in self.extra:
                formats.append(key)

        return formats

    def __str__(self) -> str:
        """
        Returns the text representation of the data.

        :return: The text representation of the data.
        """
        return self.__repr__()

    def __repr__(self) -> str:
        if self.text:
            return f"Result({self.text})"
        formats = self.formats()
        return f"Result with formats: {formats}"
