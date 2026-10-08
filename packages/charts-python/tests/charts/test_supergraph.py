import matplotlib.pyplot as plt
import numpy as np

from e2b_charts import chart_figure_to_chart
from e2b_charts.charts import (
    ChartType,
    LineChart,
    ScatterChart,
)
from e2b_charts.main import SuperChart


def _prep_chart_figure():
    # Data for plotting
    x1 = np.linspace(0, 10, 100)
    y1 = np.sin(x1)

    # Create a figure with multiple subplots
    fig, axs = plt.subplots(1, 2, figsize=(10, 8))
    fig.suptitle("Multiple Charts Example", fontsize=16)

    # Plotting on the different axes
    axs[0].plot(x1, y1, "r")
    axs[0].set_title("Sine Wave")
    axs[0].grid(True)

    N = 5
    x2 = np.random.rand(N)
    y2 = np.random.rand(N)

    axs[1].scatter(x2, y2, c="blue", label="Dataset 1")
    axs[1].set_xlabel("X")
    axs[1].set_ylabel("Y")
    axs[1].set_title("Scatter Plot")
    axs[1].grid(True)

    return plt.gcf()


def test_super_chart():
    figure = _prep_chart_figure()
    chart = chart_figure_to_chart(figure)
    assert chart

    assert isinstance(chart, SuperChart)
    assert chart.type == ChartType.SUPERCHART
    assert chart.title == "Multiple Charts Example"

    charts = chart.elements
    assert len(charts) == 2

    first_chart = charts[0]
    assert first_chart.title == "Sine Wave"
    assert isinstance(first_chart, LineChart)
    assert first_chart.x_label is None
    assert first_chart.y_label is None
    assert len(first_chart.elements) == 1
    assert len(first_chart.elements[0].points) == 100

    second_chart = charts[1]
    assert second_chart.title == "Scatter Plot"
    assert isinstance(second_chart, ScatterChart)
    assert second_chart.x_label == "X"
    assert second_chart.y_label == "Y"
    assert len(second_chart.elements) == 1
    assert len(second_chart.elements[0].points) == 5
