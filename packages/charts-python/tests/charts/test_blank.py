import matplotlib.pyplot as plt

from e2b_charts import chart_figure_to_chart


def test_blank_chart():
    figure, _ = plt.subplots()
    chart = chart_figure_to_chart(figure)
    assert chart is None
