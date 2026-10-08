code = """
import matplotlib.pyplot as plt
import numpy as np

# Create data
N = 5
x1 = np.random.rand(N)
y1 = np.random.rand(N)
x2 = np.random.rand(2*N)
y2 = np.random.rand(2*N)

plt.xlabel("A")
plt.ylabel("B")

plt.scatter(x1, y1, c='blue', label='Dataset 1')
plt.scatter(x2, y2, c='red', label='Dataset 2')

plt.show()
"""


def test_scatter_chart(run_chart):
    chart = run_chart(code)

    assert chart["type"] == "scatter"

    assert chart["title"] is None
    assert chart["x_label"] == "A"
    assert chart["y_label"] == "B"

    assert chart["x_scale"] == "linear"
    assert chart["y_scale"] == "linear"

    assert all(isinstance(x, float) for x in chart["x_ticks"])
    assert all(isinstance(y, float) for y in chart["y_ticks"])

    assert all(isinstance(x, str) for x in chart["x_tick_labels"])
    assert all(isinstance(y, str) for y in chart["y_tick_labels"])

    assert len(chart["elements"]) == 2

    first_data = chart["elements"][0]
    assert first_data["label"] == "Dataset 1"
    assert len(first_data["points"]) == 5
    assert all(len(point) == 2 for point in first_data["points"])

    second_data = chart["elements"][1]
    assert second_data["label"] == "Dataset 2"
    assert len(second_data["points"]) == 10
    assert all(len(point) == 2 for point in second_data["points"])
