from decimal import Decimal
from typing import Literal, List

from matplotlib.axes import Axes
from pydantic import BaseModel, Field

from .base import Chart, ChartType
from ..utils.rounding import dynamic_round


class PieData(BaseModel):
    label: str
    angle: float
    radius: float


class PieChart(Chart):
    type: Literal[ChartType.PIE] = ChartType.PIE

    elements: List[PieData] = Field(default_factory=list)

    def _extract_info(self, ax: Axes) -> None:
        super()._extract_info(ax)

        for wedge in ax.patches:
            pie_data = PieData(
                label=wedge.get_label(),
                angle=abs(
                    dynamic_round(
                        Decimal(float(wedge.theta2)) - Decimal(float(wedge.theta1))
                    )
                ),
                radius=wedge.r,
            )

            self.elements.append(pie_data)
