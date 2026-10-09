import matplotlib.pyplot as plt

from e2b_charts import chart_figure_to_chart
from e2b_charts.charts import PieChart


def _prep_chart_figure():
    # Step 1: Define the data for the pie chart
    categories = ["No", "No, in blue"]
    sizes = [90, 10]

    # Step 2: Create the figure and axis objects
    fig, ax = plt.subplots(figsize=(8, 8))

    plt.xlabel("x")
    plt.ylabel("y")

    # Step 3: Create the pie chart
    ax.pie(
        sizes,
        labels=categories,
        autopct="%1.1f%%",
        startangle=90,
        colors=plt.cm.Pastel1.colors[: len(categories)],
    )

    # Step 4: Add title and legend
    ax.axis("equal")  # Equal aspect ratio ensures that pie is drawn as a circle
    plt.title("Will I wake up early tomorrow?")

    return plt.gcf()


def test_pie_chart():
    figure = _prep_chart_figure()
    chart = chart_figure_to_chart(figure)
    assert chart

    assert isinstance(chart, PieChart)

    assert chart.title == "Will I wake up early tomorrow?"

    assert len(chart.elements) == 2

    first_data = chart.elements[0]
    assert first_data.label == "No"
    assert first_data.angle == 324
    assert first_data.radius == 1

    second_data = chart.elements[1]
    assert second_data.label == "No, in blue"
    assert second_data.angle == 36
    assert second_data.radius == 1
