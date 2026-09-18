import json
from dataclasses import asdict
from typing import Any

from pydantic import TypeAdapter

from e2b_code_interpreter.charts import LineChart, ScatterChart, SuperChart
from e2b_code_interpreter.models import Result

_LINE = {
    "type": "line",
    "title": "Sine Wave",
    "x_label": None,
    "y_label": None,
    "x_unit": None,
    "y_unit": None,
    "x_ticks": [0],
    "x_tick_labels": ["0"],
    "x_scale": "linear",
    "y_ticks": [0],
    "y_tick_labels": ["0"],
    "y_scale": "linear",
    "elements": [{"label": "sin", "points": [(0, 0)]}],
}
_SCATTER = {
    "type": "scatter",
    "title": "Scatter Plot",
    "x_label": "X",
    "y_label": "Y",
    "x_unit": None,
    "y_unit": None,
    "x_ticks": [0],
    "x_tick_labels": ["0"],
    "x_scale": "linear",
    "y_ticks": [0],
    "y_tick_labels": ["0"],
    "y_scale": "linear",
    "elements": [{"label": "Dataset 1", "points": [(0.1, 0.2)]}],
}


def test_result_chart_json_dump_keeps_nested_superchart():
    raw = {
        "type": "superchart",
        "title": "Multiple Charts Example",
        "elements": [_LINE, _SCATTER],
    }
    result = Result(text="ok", chart=raw, is_main_result=True)
    chart = result.chart
    assert isinstance(chart, SuperChart)
    assert isinstance(chart.elements[0], LineChart)
    assert isinstance(chart.elements[1], ScatterChart)

    dumped = json.loads(TypeAdapter(Any).dump_json(result))
    assert dumped["chart"]["type"] == "superchart"
    assert dumped["chart"]["elements"][0]["title"] == "Sine Wave"
    assert dumped["chart"]["elements"][1]["title"] == "Scatter Plot"

    payload = json.loads(json.dumps(asdict(chart)))
    assert payload["type"] == "superchart"
    assert payload["elements"][0]["type"] == "line"
    assert payload["elements"][1]["type"] == "scatter"
