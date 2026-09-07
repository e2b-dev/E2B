import json
from dataclasses import asdict
from typing import Any

import pytest

from e2b_code_interpreter.charts import (
    BarChart,
    BoxAndWhiskerChart,
    LineChart,
    PieChart,
    ScatterChart,
    SuperChart,
)


def _line_chart_payload():
    return {
        "type": "line",
        "title": "Sine Wave",
        "x_label": None,
        "y_label": None,
        "x_unit": None,
        "y_unit": None,
        "x_ticks": [0, 1],
        "x_tick_labels": ["0", "1"],
        "x_scale": "linear",
        "y_ticks": [0, 1],
        "y_tick_labels": ["0", "1"],
        "y_scale": "linear",
        "elements": [{"label": "sin", "points": [(0, 0), (1, 1)]}],
    }


def _scatter_chart_payload():
    return {
        "type": "scatter",
        "title": "Scatter Plot",
        "x_label": "X",
        "y_label": "Y",
        "x_unit": None,
        "y_unit": None,
        "x_ticks": [0, 1],
        "x_tick_labels": ["0", "1"],
        "x_scale": "linear",
        "y_ticks": [0, 1],
        "y_tick_labels": ["0", "1"],
        "y_scale": "linear",
        "elements": [{"label": "Dataset 1", "points": [(0.1, 0.2)]}],
    }


def _pie_chart_payload():
    return {
        "type": "pie",
        "title": "Share",
        "elements": [{"label": "A", "angle": 2.0, "radius": 1.0}],
    }


def _bar_chart_payload():
    return {
        "type": "bar",
        "title": "Counts",
        "x_label": "X",
        "y_label": "Y",
        "x_unit": None,
        "y_unit": None,
        "elements": [{"label": "A", "value": "1", "group": "g"}],
    }


def _box_chart_payload():
    return {
        "type": "box_and_whisker",
        "title": "Spread",
        "x_label": None,
        "y_label": None,
        "x_unit": None,
        "y_unit": None,
        "elements": [
            {
                "label": "s",
                "min": 0.0,
                "first_quartile": 1.0,
                "median": 2.0,
                "third_quartile": 3.0,
                "max": 4.0,
                "outliers": [],
            }
        ],
    }


def _superchart():
    return SuperChart(
        type="superchart",
        title="Multiple Charts Example",
        elements=[
            _line_chart_payload(),
            _scatter_chart_payload(),
            _pie_chart_payload(),
            _bar_chart_payload(),
            _box_chart_payload(),
        ],
    )


def test_superchart_json_dump_keeps_nested_charts():
    chart = _superchart()

    assert isinstance(chart, SuperChart)
    assert isinstance(chart.elements[0], LineChart)
    assert isinstance(chart.elements[1], ScatterChart)
    assert isinstance(chart.elements[2], PieChart)
    assert isinstance(chart.elements[3], BarChart)
    assert isinstance(chart.elements[4], BoxAndWhiskerChart)

    payload = json.loads(json.dumps(asdict(chart)))
    assert payload["type"] == "superchart"
    assert payload["title"] == "Multiple Charts Example"
    assert payload["elements"][0]["type"] == "line"
    assert payload["elements"][0]["title"] == "Sine Wave"
    assert payload["elements"][0]["elements"][0]["points"] == [[0, 0], [1, 1]]
    assert payload["elements"][1]["type"] == "scatter"
    assert payload["elements"][1]["title"] == "Scatter Plot"
    assert payload["elements"][2]["type"] == "pie"
    assert payload["elements"][2]["elements"][0]["angle"] == 2.0
    assert payload["elements"][3]["type"] == "bar"
    assert payload["elements"][3]["elements"][0]["value"] == "1"
    assert payload["elements"][4]["type"] == "box_and_whisker"
    assert payload["elements"][4]["elements"][0]["median"] == 2.0


def test_superchart_pydantic_json_dump():
    pydantic = pytest.importorskip("pydantic")

    chart = _superchart()
    payload = json.loads(pydantic.TypeAdapter(Any).dump_json(chart))
    assert payload["type"] == "superchart"
    assert payload["title"] == "Multiple Charts Example"
    assert payload["elements"][0]["type"] == "line"
    assert payload["elements"][1]["type"] == "scatter"
    assert payload["elements"][2]["type"] == "pie"
    assert payload["elements"][3]["type"] == "bar"
    assert payload["elements"][4]["type"] == "box_and_whisker"
    assert payload["elements"][0]["elements"][0]["label"] == "sin"
