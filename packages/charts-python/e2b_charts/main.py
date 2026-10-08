from typing import Optional, List, Literal

from matplotlib.axes import Axes
from matplotlib.collections import PathCollection
from matplotlib.lines import Line2D
from matplotlib.patches import Rectangle, Wedge, PathPatch
from matplotlib.pyplot import Figure

from matplotlib.text import Text
from pydantic import Field

from .charts import (
    ChartType,
    Chart,
    LineChart,
    BarChart,
    BoxAndWhiskerChart,
    PieChart,
    ScatterChart,
)
from .utils.filtering import is_grid_line


class SuperChart(Chart):
    type: Literal[ChartType.SUPERCHART] = ChartType.SUPERCHART
    elements: List[
        LineChart | ScatterChart | BarChart | PieChart | BoxAndWhiskerChart
    ] = Field(default_factory=list)

    def __init__(self, figure: Figure):
        title = figure.get_suptitle()
        super().__init__(title=title)

        self.elements = [get_chart_from_ax(ax) for ax in figure.axes]


def _get_type_of_chart(ax: Axes) -> ChartType:
    objects = list(filter(lambda obj: not isinstance(obj, Text), ax._children))

    # Check for Line plots
    if all(isinstance(line, Line2D) for line in objects):
        return ChartType.LINE

    if all(isinstance(box_or_path, (PathPatch, Line2D)) for box_or_path in objects):
        return ChartType.BOX_AND_WHISKER

    filtered = []
    for obj in objects:
        if isinstance(obj, Line2D) and is_grid_line(obj):
            continue
        filtered.append(obj)

    objects = filtered

    # Check for Scatter plots
    if all(isinstance(path, PathCollection) for path in objects):
        return ChartType.SCATTER

    # Check for Pie plots
    if all(isinstance(artist, Wedge) for artist in objects):
        return ChartType.PIE

    # Check for Bar plots
    if all(isinstance(rect, Rectangle) for rect in objects):
        return ChartType.BAR

    return ChartType.UNKNOWN


def get_chart_from_ax(
    ax: Axes,
) -> LineChart | ScatterChart | BarChart | PieChart | BoxAndWhiskerChart | Chart:
    chart_type = _get_type_of_chart(ax)

    if chart_type == ChartType.LINE:
        chart = LineChart(ax=ax)
    elif chart_type == ChartType.SCATTER:
        chart = ScatterChart(ax=ax)
    elif chart_type == ChartType.BAR:
        chart = BarChart(ax=ax)
    elif chart_type == ChartType.PIE:
        chart = PieChart(ax=ax)
    elif chart_type == ChartType.BOX_AND_WHISKER:
        chart = BoxAndWhiskerChart(ax=ax)
    else:
        chart = Chart(ax=ax, type=chart_type)

    return chart


def is_figure_blank(axes: List[Axes]) -> bool:
    """Check if a Matplotlib figure is blank (has no user-added artists)."""
    for ax in axes:
        if ax.has_data():
            return False  # The figure contains user-added data
    return True  # No data found, figure is blank


def chart_figure_to_chart(figure: Figure) -> Optional[Chart]:
    """
    This method is used to extract data from the figure object to a dictionary
    """
    # Get all Axes objects from the Figure
    axes = figure.get_axes()

    if not axes or is_figure_blank(axes):
        return
    elif len(axes) > 1:
        return SuperChart(figure=figure)
    else:
        ax = axes[0]
        return get_chart_from_ax(ax)


def chart_figure_to_dict(figure: Figure) -> dict:
    chart = chart_figure_to_chart(figure)
    if chart:
        return chart.model_dump()
    return {}
