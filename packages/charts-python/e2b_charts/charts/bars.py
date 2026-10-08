from typing import Literal, List

from matplotlib.axes import Axes
from pydantic import BaseModel, Field

from .base import Chart2D, ChartType
from ..utils.rounding import dynamic_round


class BarData(BaseModel):
    label: str
    group: str
    value: float


class BarChart(Chart2D):
    type: Literal[ChartType.BAR] = ChartType.BAR

    elements: List[BarData] = Field(default_factory=list)

    def _extract_info(self, ax: Axes) -> None:
        super()._extract_info(ax)
        for container in ax.containers:
            group_label = container.get_label()
            if group_label.startswith("_container"):
                number = int(group_label[10:])
                group_label = f"Group {number}"

            heights = [rect.get_height() for rect in container]
            if all(height == heights[0] for height in heights):
                # vertical bars
                self._change_orientation()
                labels = [label.get_text() for label in ax.get_yticklabels()]
                values = [rect.get_width() for rect in container]
            else:
                # horizontal bars
                labels = [label.get_text() for label in ax.get_xticklabels()]
                values = heights
            for label, value in zip(labels, values):
                bar = BarData(label=label, value=value, group=group_label)
                self.elements.append(bar)


class BoxAndWhiskerData(BaseModel):
    label: str
    min: float
    first_quartile: float
    median: float
    third_quartile: float
    max: float
    outliers: List[float]


class BoxAndWhiskerChart(Chart2D):
    type: Literal[ChartType.BOX_AND_WHISKER] = ChartType.BOX_AND_WHISKER

    elements: List[BoxAndWhiskerData] = Field(default_factory=list)

    def _extract_info(self, ax: Axes) -> None:
        super()._extract_info(ax)
        labels = [item.get_text() for item in ax.get_xticklabels()]

        boxes = []
        for label, box in zip(labels, ax.patches):
            vertices = box.get_path().vertices
            x_vertices = [dynamic_round(x) for x in vertices[:, 0]]
            y_vertices = [dynamic_round(y) for y in vertices[:, 1]]
            x = min(x_vertices)
            y = min(y_vertices)
            boxes.append(
                {
                    "x": x,
                    "y": y,
                    "label": label,
                    "width": max(x_vertices) - x,
                    "height": max(y_vertices) - y,
                    "outliers": [],
                }
            )

        orientation = "horizontal"
        if all(box["height"] == boxes[0]["height"] for box in boxes):
            orientation = "vertical"

        if orientation == "vertical":
            self._change_orientation()
            for box in boxes:
                box["x"], box["y"] = box["y"], box["x"]
                box["width"], box["height"] = box["height"], box["width"]

        for i, line in enumerate(ax.lines):
            xdata = [dynamic_round(x) for x in line.get_xdata()]
            ydata = [dynamic_round(y) for y in line.get_ydata()]

            if orientation == "vertical":
                xdata, ydata = ydata, xdata

            if len(xdata) == 1:
                for box in boxes:
                    if box["x"] <= xdata[0] <= box["x"] + box["width"]:
                        break
                else:
                    continue

                box["outliers"].append(ydata[0])
            if len(ydata) != 2:
                continue
            for box in boxes:
                if box["x"] <= xdata[0] <= xdata[1] <= box["x"] + box["width"]:
                    break
            else:
                continue

            if (
                # Check if the line is inside the box, prevent floating point errors
                ydata[0] == ydata[1]
                and box["y"] <= ydata[0] <= box["y"] + box["height"]
            ):
                box["median"] = ydata[0]
                continue

            lower_value = min(ydata)
            upper_value = max(ydata)
            if upper_value == box["y"]:
                box["whisker_lower"] = lower_value
            elif lower_value == box["y"] + box["height"]:
                box["whisker_upper"] = upper_value

        self.elements = [
            BoxAndWhiskerData(
                label=box["label"],
                min=box["whisker_lower"],
                first_quartile=box["y"],
                median=box["median"],
                third_quartile=box["y"] + box["height"],
                max=box["whisker_upper"],
                outliers=box["outliers"],
            )
            for box in boxes
        ]
