code = """
import matplotlib.pyplot as plt
import numpy as np

# Sample data
data = {
    'Class A': [85, 90, 78, 92, 88],
    'Class B': [95, 89, 76, 91, 84, 87],
    'Class C': [75, 82, 88, 79, 86]
}

# Create figure and axis
fig, ax = plt.subplots(figsize=(10, 6))

# Customize plot
ax.set_title('Exam Scores Distribution')
ax.set_xlabel('Class')
ax.set_ylabel('Score')

# Set custom colors
ax.boxplot(data.values(), labels=data.keys(), patch_artist=True)

# Add legend
ax.legend()

# Adjust layout and show plot
plt.tight_layout()
plt.show()
"""


def test_box_and_whiskers(run_chart):
    chart = run_chart(code)

    assert chart["type"] == "box_and_whisker"
    assert chart["title"] == "Exam Scores Distribution"

    assert chart["x_label"] == "Class"
    assert chart["y_label"] == "Score"

    assert chart["x_unit"] is None
    assert chart["y_unit"] is None

    bars = chart["elements"]
    assert len(bars) == 3

    assert [bar["outliers"] for bar in bars] == [[], [76], []]
    assert [bar["min"] for bar in bars] == [78, 84, 75]
    assert [bar["first_quartile"] for bar in bars] == [85, 84.75, 79]
    assert [bar["median"] for bar in bars] == [88, 88, 82]
    assert [bar["third_quartile"] for bar in bars] == [90, 90.5, 86]
    assert [bar["max"] for bar in bars] == [92, 95, 88]
    assert [bar["label"] for bar in bars] == ["Class A", "Class B", "Class C"]
