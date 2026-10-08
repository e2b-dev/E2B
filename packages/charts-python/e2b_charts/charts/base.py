import enum
import re
from typing import Optional, List, Any

from matplotlib.axes import Axes
from pydantic import BaseModel, Field


class ChartType(str, enum.Enum):
    LINE = "line"
    SCATTER = "scatter"
    BAR = "bar"
    PIE = "pie"
    BOX_AND_WHISKER = "box_and_whisker"
    SUPERCHART = "superchart"
    UNKNOWN = "unknown"


class Chart(BaseModel):
    type: ChartType
    title: Optional[str] = None

    elements: List[Any] = Field(default_factory=list)

    def __init__(self, ax: Optional[Axes] = None, **kwargs):
        super().__init__(**kwargs)
        if ax:
            self._extract_info(ax)

    def _extract_info(self, ax: Axes) -> None:
        """
        Function to extract information for Chart
        """
        title = ax.get_title()
        if title == "":
            title = None

        self.title = title


class Chart2D(Chart):
    x_label: Optional[str] = None
    y_label: Optional[str] = None
    x_unit: Optional[str] = None
    y_unit: Optional[str] = None

    def _extract_info(self, ax: Axes) -> None:
        """
        Function to extract information for Chart2D
        """
        super()._extract_info(ax)
        x_label = ax.get_xlabel()
        if x_label == "":
            x_label = None
        self.x_label = x_label

        y_label = ax.get_ylabel()
        if y_label == "":
            y_label = None
        self.y_label = y_label

        regex = r"\s\((.*?)\)|\[(.*?)\]"
        if self.x_label:
            match = re.search(regex, self.x_label)
            if match:
                self.x_unit = match.group(1) or match.group(2)

        if self.y_label:
            match = re.search(regex, self.y_label)
            if match:
                self.y_unit = match.group(1) or match.group(2)

    def _change_orientation(self):
        self.x_label, self.y_label = self.y_label, self.x_label
        self.x_unit, self.y_unit = self.y_unit, self.x_unit
