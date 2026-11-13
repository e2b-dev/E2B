import json

import pytest

from e2b_code_interpreter.charts import (
    BarChart,
    BoxAndWhiskerChart,
    Chart,
    ChartType,
    LineChart,
    PieChart,
    ScaleType,
    ScatterChart,
    SuperChart,
    _deserialize_chart,
)
from e2b_code_interpreter.models import Execution, Result

AXES = {"x_label": "x", "y_label": "y", "x_unit": None, "y_unit": None}
TICKS = {
    "x_ticks": [0, 1],
    "x_tick_labels": ["0", "1"],
    "x_scale": "linear",
    "y_ticks": [0, 1],
    "y_tick_labels": ["0", "1"],
    "y_scale": "log",
}

LINE = {
    "type": "line",
    "title": "line",
    **AXES,
    **TICKS,
    "elements": [{"label": "a", "points": [[0, 0], [1, 1]]}],
}
SCATTER = {**LINE, "type": "scatter", "title": "scatter"}
BAR = {
    "type": "bar",
    "title": "bar",
    **AXES,
    "elements": [{"label": "a", "value": "1", "group": "g"}],
}
PIE = {
    "type": "pie",
    "title": "pie",
    "elements": [{"label": "a", "angle": 180.0, "radius": 1.0}],
}
BOX = {
    "type": "box_and_whisker",
    "title": "box",
    **AXES,
    "elements": [
        {
            "label": "a",
            "min": 0.0,
            "first_quartile": 1.0,
            "median": 2.0,
            "third_quartile": 3.0,
            "max": 4.0,
            "outliers": None,
        }
    ],
}
SUPERCHART = {"type": "superchart", "title": "super", "elements": [LINE, SCATTER]}
UNKNOWN = {"type": "unknown", "title": "unknown", "elements": []}


@pytest.mark.parametrize(
    ("payload", "cls", "chart_type"),
    [
        (LINE, LineChart, ChartType.LINE),
        (SCATTER, ScatterChart, ChartType.SCATTER),
        (BAR, BarChart, ChartType.BAR),
        (PIE, PieChart, ChartType.PIE),
        (BOX, BoxAndWhiskerChart, ChartType.BOX_AND_WHISKER),
        (SUPERCHART, SuperChart, ChartType.SUPERCHART),
        (UNKNOWN, Chart, ChartType.UNKNOWN),
    ],
)
def test_deserialize_chart(payload, cls, chart_type):
    chart = _deserialize_chart(payload)

    assert isinstance(chart, cls)
    assert chart.type == chart_type
    assert chart.title == payload["title"]
    assert chart.to_dict() == payload


def test_deserialize_point_chart_fields():
    chart = _deserialize_chart(LINE)

    assert isinstance(chart, LineChart)
    assert chart.x_label == "x"
    assert chart.x_scale == ScaleType.LINEAR
    assert chart.y_scale == ScaleType.LOG
    assert chart.x_ticks == [0, 1]
    assert chart.elements[0].label == "a"
    assert chart.elements[0].points == [(0, 0), (1, 1)]


def test_deserialize_unknown_scale_falls_back():
    chart = _deserialize_chart({**LINE, "x_scale": "weird"})

    assert isinstance(chart, LineChart)
    assert chart.x_scale == ScaleType.UNKNOWN


def test_deserialize_box_and_whisker_outliers_default():
    chart = _deserialize_chart(BOX)

    assert isinstance(chart, BoxAndWhiskerChart)
    assert chart.elements[0].median == 2.0
    assert chart.elements[0].outliers == []


def test_deserialize_superchart_nests_charts():
    chart = _deserialize_chart(SUPERCHART)

    assert isinstance(chart, SuperChart)
    assert [type(c) for c in chart.elements] == [LineChart, ScatterChart]


def test_deserialize_empty_chart():
    assert _deserialize_chart(None) is None
    assert _deserialize_chart({}) is None


def test_result_chart_round_trips_through_to_json():
    execution = Execution(results=[Result(chart=BAR, is_main_result=True)])

    assert isinstance(execution.results[0].chart, BarChart)
    assert "chart" in execution.results[0].formats()
    assert json.loads(execution.to_json())["results"][0]["chart"] == BAR
