code = """
import matplotlib.pyplot as plt
import numpy as np

# Create a figure and an axis
fig, ax = plt.subplots()

# Create data for two concentric circles
circle1 = plt.Circle((0, 0), 1, color='blue', fill=False, linewidth=2)
circle2 = plt.Circle((0, 0), 2, color='red', fill=False, linewidth=2)

# Add the circles to the axes
ax.add_artist(circle1)
ax.add_artist(circle2)

# Set grid
ax.grid(True)

# Set title
plt.title('Two Concentric Circles')

# Show the plot
plt.show()
"""


def test_unknown_charts(run_chart):
    chart = run_chart(code)

    assert chart["type"] == "unknown"
    assert chart["title"] == "Two Concentric Circles"

    assert chart["elements"] == []
