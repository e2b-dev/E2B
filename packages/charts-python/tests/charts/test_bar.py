import matplotlib.pyplot as plt

from e2b_charts import chart_figure_to_chart
from e2b_charts.charts import BarChart, ChartType


def _prep_chart_figure():
    # Prepare data
    authors = ["Author A", "Author B", "Author C", "Author D"]
    sales = [100, 200, 300, 400]

    # Create and customize the bar chart
    plt.figure(figsize=(10, 6))
    plt.bar(authors, sales, label="Books Sold", color="blue")
    plt.xlabel("Authors")
    plt.ylabel("Number of Books Sold")
    plt.title("Book Sales by Authors")

    # Display the chart
    plt.tight_layout()
    return plt.gcf()


def test_chart_bar():
    figure = _prep_chart_figure()
    chart = chart_figure_to_chart(figure)
    assert chart

    assert isinstance(chart, BarChart)
    assert chart.type == ChartType.BAR
    assert chart.title == "Book Sales by Authors"

    assert chart.x_label == "Authors"
    assert chart.y_label == "Number of Books Sold"

    assert chart.x_unit is None
    assert chart.y_unit is None

    bars = chart.elements
    assert len(bars) == 4

    assert [bar.value for bar in bars] == [100, 200, 300, 400]
    assert [bar.label for bar in bars] == [
        "Author A",
        "Author B",
        "Author C",
        "Author D",
    ]
    assert [bar.group for bar in bars] == ["Books Sold"] * 4
