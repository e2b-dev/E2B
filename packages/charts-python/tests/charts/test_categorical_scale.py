import matplotlib.pyplot as plt

from e2b_charts import chart_figure_to_chart
from e2b_charts.charts import LineChart


def _prep_chart_figure():
    x = [1, 2, 3, 4, 5]
    y = ["A", "B", "C", "D", "E"]

    # Create the plot
    plt.figure(figsize=(10, 6))
    plt.plot(x, y)

    return plt.gcf()


def test_categorical_scale():
    figure = _prep_chart_figure()
    chart = chart_figure_to_chart(figure)
    assert chart

    assert isinstance(chart, LineChart)
    assert chart.x_scale == "linear"
    assert chart.y_scale == "categorical"
