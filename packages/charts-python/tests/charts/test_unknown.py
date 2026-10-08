import matplotlib.pyplot as plt

from e2b_charts import chart_figure_to_chart
from e2b_charts.charts import Chart, ChartType


def _prep_chart_figure():
    # Create a figure and an axis
    fig, ax = plt.subplots()

    # Create data for two concentric circles
    circle1 = plt.Circle((0, 0), 1, color="blue", fill=False, linewidth=2)
    circle2 = plt.Circle((0, 0), 2, color="red", fill=False, linewidth=2)

    # Add the circles to the axes
    ax.add_artist(circle1)
    ax.add_artist(circle2)

    # Set grid
    ax.grid(True)

    # Set title
    plt.title("Two Concentric Circles")

    return plt.gcf()


def test_unknown_charts():
    figure = _prep_chart_figure()
    chart = chart_figure_to_chart(figure)
    assert chart

    assert isinstance(chart, Chart)
    assert chart.type == ChartType.UNKNOWN
    assert chart.title == "Two Concentric Circles"

    assert len(chart.elements) == 0
