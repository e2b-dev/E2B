import numpy as np
import matplotlib.pyplot as plt
import datetime

from e2b_charts import chart_figure_to_chart
from e2b_charts.charts import LineChart


def _prep_chart_figure():
    # Generate x values
    dates = [
        datetime.date(2023, 9, 1) + datetime.timedelta(seconds=i) for i in range(100)
    ]
    y_sin = np.sin(np.linspace(0, 2 * np.pi, 100))

    # Create the plot
    plt.figure(figsize=(10, 6))
    plt.plot(dates, y_sin, label="sin(x)")

    return plt.gcf()


def test_datetime_scale():
    figure = _prep_chart_figure()
    chart = chart_figure_to_chart(figure)
    assert chart

    assert isinstance(chart, LineChart)
    assert chart.x_scale == "datetime"
    assert chart.y_scale == "linear"
