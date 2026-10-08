import datetime

from matplotlib.dates import _SwitchableDateConverter

from e2b_charts.charts.planar import PointChart


def test_detect_scale():
    datetime_converter = _SwitchableDateConverter()
    scale = PointChart._detect_scale(
        datetime_converter, "linear", 3 * [datetime.date.today()], ["1", "2", "3"]
    )
    assert scale == "datetime"

    scale = PointChart._detect_scale(None, "linear", [1, 2, 3], ["1", "2", "3"])
    assert scale == "linear"

    scale = PointChart._detect_scale(
        None, "linear", [0, 1, 2], ["First", "Second", "Third"]
    )
    assert scale == "categorical"

    scale = PointChart._detect_scale(None, "log", [1, 10, 100], ["1", "10", "100"])
    assert scale == "log"
