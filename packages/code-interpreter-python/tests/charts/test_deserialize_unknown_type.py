from e2b_code_interpreter.charts import (
    Chart,
    ChartType,
    SuperChart,
    _deserialize_chart,
)


def test_unrecognized_type_becomes_unknown():
    chart = _deserialize_chart({"type": "not-a-chart", "title": "x", "elements": []})
    assert isinstance(chart, Chart)
    assert chart.type == ChartType.UNKNOWN
    assert chart.title == "x"


def test_unknown_literal_stays_unknown():
    chart = _deserialize_chart({"type": "unknown", "title": "x", "elements": []})
    assert chart.type == ChartType.UNKNOWN


def test_superchart_nested_unrecognized_type():
    chart = _deserialize_chart(
        {
            "type": "superchart",
            "title": "s",
            "elements": [
                {"type": "not-a-chart", "title": "nested", "elements": []},
            ],
        }
    )
    assert isinstance(chart, SuperChart)
    assert len(chart.elements) == 1
    assert chart.elements[0].type == ChartType.UNKNOWN
    assert chart.elements[0].title == "nested"
