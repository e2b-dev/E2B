from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.charts import LineChart

# Log chart
code = """
import numpy as np
import matplotlib.pyplot as plt

# Generate x values
x = np.linspace(0, 100, 100)
# Calculate y values
y = np.exp(x)

# Create the plot
plt.figure(figsize=(10, 6))
plt.plot(x, y, label='y = e^x')

# Set log scale for the y-axis
plt.yscale('log')

# Add labels and title
plt.xlabel('X-axis')
plt.ylabel('Y-axis (log scale)')
plt.title('Chart with Log Scale on Y-axis')

plt.legend()
plt.grid(True)
plt.show()
"""


async def test_log_chart(async_sandbox: AsyncSandbox):
    result = await async_sandbox.run_code(code)

    chart = result.results[0].chart
    assert chart

    assert isinstance(chart, LineChart)
    assert chart.title == "Chart with Log Scale on Y-axis"

    assert chart.x_label == "X-axis"
    assert chart.y_label == "Y-axis (log scale)"

    assert chart.x_unit is None
    assert chart.y_unit == "log scale"

    assert chart.x_scale == "linear"
    assert chart.y_scale == "log"

    assert all(isinstance(x, float) for x in chart.x_ticks)
    assert all(isinstance(y, float) for y in chart.y_ticks)

    assert all(isinstance(x, str) for x in chart.x_tick_labels)
    assert all(isinstance(y, str) for y in chart.y_tick_labels)

    lines = chart.elements
    assert len(lines) == 1

    line = lines[0]
    assert line.label == "y = e^x"
    assert len(line.points) == 100

    assert all(isinstance(x, tuple) for x in line.points)
    assert all(isinstance(x, float) and isinstance(y, float) for x, y in line.points)
