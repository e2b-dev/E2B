import enum
from typing import Any, List, Tuple, Optional, Union


class ChartType(str, enum.Enum):
    """
    Chart types
    """

    LINE = "line"
    SCATTER = "scatter"
    BAR = "bar"
    PIE = "pie"
    BOX_AND_WHISKER = "box_and_whisker"
    SUPERCHART = "superchart"
    UNKNOWN = "unknown"


class ScaleType(str, enum.Enum):
    """
    Ax scale types
    """

    LINEAR = "linear"
    DATETIME = "datetime"
    CATEGORICAL = "categorical"
    LOG = "log"
    SYMLOG = "symlog"
    LOGIT = "logit"
    FUNCTION = "function"
    FUNCTIONLOG = "functionlog"
    ASINH = "asinh"
    UNKNOWN = "unknown"


class Chart:
    """
    Extracted data from a chart. It's useful for building an interactive charts or custom visualizations.
    """

    type: ChartType
    title: str

    elements: List[Any]

    def __init__(self, **kwargs):
        self._raw_data = kwargs
        try:
            self.type = ChartType(kwargs["type"])
        except ValueError:
            self.type = ChartType.UNKNOWN
        self.title = kwargs.get("title", "")
        self.elements = kwargs.get("elements", [])

    def to_dict(self) -> dict:
        return self._raw_data


class Chart2D(Chart):
    x_label: Optional[str]
    y_label: Optional[str]
    x_unit: Optional[str]
    y_unit: Optional[str]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.x_label = kwargs.get("x_label")
        self.y_label = kwargs.get("y_label")
        self.x_unit = kwargs.get("x_unit")
        self.y_unit = kwargs.get("y_unit")


class PointData:
    label: str
    points: List[Tuple[Union[str, float], Union[str, float]]]

    def __init__(self, **kwargs):
        self.label = kwargs["label"]
        self.points = [(x, y) for x, y in kwargs["points"]]


class PointChart(Chart2D):
    x_ticks: List[Union[str, float]]
    x_tick_labels: List[str]
    x_scale: ScaleType

    y_ticks: List[Union[str, float]]
    y_tick_labels: List[str]
    y_scale: ScaleType

    elements: List[PointData]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.x_label = kwargs.get("x_label")

        try:
            self.x_scale = ScaleType(kwargs.get("x_scale"))
        except ValueError:
            self.x_scale = ScaleType.UNKNOWN

        self.x_ticks = kwargs.get("x_ticks", [])
        self.x_tick_labels = kwargs.get("x_tick_labels", [])

        self.y_label = kwargs.get("y_label")

        try:
            self.y_scale = ScaleType(kwargs.get("y_scale"))
        except ValueError:
            self.y_scale = ScaleType.UNKNOWN

        self.y_ticks = kwargs.get("y_ticks", [])
        self.y_tick_labels = kwargs.get("y_tick_labels", [])

        elements = kwargs.get("elements", [])
        self.elements = [PointData(**d) for d in elements]


class LineChart(PointChart):
    type = ChartType.LINE


class ScatterChart(PointChart):
    type = ChartType.SCATTER


class BarData:
    label: str
    group: str
    value: str

    def __init__(self, **kwargs):
        self.label = kwargs.get("label")
        self.value = kwargs.get("value")
        self.group = kwargs.get("group")


class BarChart(Chart2D):
    type = ChartType.BAR

    elements: List[BarData]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        elements = kwargs.get("elements", [])
        self.elements = [BarData(**d) for d in elements]


class PieData:
    label: str
    angle: float
    radius: float

    def __init__(self, **kwargs):
        self.label = kwargs.get("label")
        self.angle = kwargs.get("angle")
        self.radius = kwargs.get("radius")


class PieChart(Chart):
    type = ChartType.PIE

    elements: List[PieData]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        elements = kwargs.get("elements", [])
        self.elements = [PieData(**d) for d in elements]


class BoxAndWhiskerData:
    label: str
    min: float
    first_quartile: float
    median: float
    third_quartile: float
    max: float
    outliers: List[float]

    def __init__(self, **kwargs):
        self.label = kwargs.get("label")
        self.min = kwargs.get("min")
        self.first_quartile = kwargs.get("first_quartile")
        self.median = kwargs.get("median")
        self.third_quartile = kwargs.get("third_quartile")
        self.max = kwargs.get("max")
        self.outliers = kwargs.get("outliers") or []


class BoxAndWhiskerChart(Chart2D):
    type = ChartType.BOX_AND_WHISKER

    elements: List[BoxAndWhiskerData]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        elements = kwargs.get("elements", [])
        self.elements = [BoxAndWhiskerData(**d) for d in elements]


class SuperChart(Chart):
    type = ChartType.SUPERCHART

    elements: List[Chart]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.elements = []
        for raw_chart in kwargs.get("elements", []):
            chart = _deserialize_chart(raw_chart)
            if chart is not None:
                self.elements.append(chart)


ChartTypes = Union[
    Chart, LineChart, ScatterChart, BarChart, PieChart, BoxAndWhiskerChart, SuperChart
]


def _deserialize_chart(data: Optional[dict]) -> Optional[ChartTypes]:
    if not data:
        return None

    if data["type"] == ChartType.LINE:
        chart = LineChart(**data)
    elif data["type"] == ChartType.SCATTER:
        chart = ScatterChart(**data)
    elif data["type"] == ChartType.BAR:
        chart = BarChart(**data)
    elif data["type"] == ChartType.PIE:
        chart = PieChart(**data)
    elif data["type"] == ChartType.BOX_AND_WHISKER:
        chart = BoxAndWhiskerChart(**data)
    elif data["type"] == ChartType.SUPERCHART:
        chart = SuperChart(**data)
    else:
        chart = Chart(**data)

    return chart
