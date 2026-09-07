import datetime

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.charts import LineChart

code = """
import numpy as np
import matplotlib.pyplot as plt
import datetime

# Generate x values
dates = [datetime.date(2023, 9, 1) + datetime.timedelta(seconds=i) for i in range(100)]

x = np.linspace(0, 2*np.pi, 100)
# Calculate y values
y_sin = np.sin(x)
y_cos = np.cos(x)

# Create the plot
plt.figure(figsize=(10, 6))
plt.plot(dates, y_sin, label='sin(x)')
plt.plot(dates, y_cos, label='cos(x)')

# Add labels and title
plt.xlabel("Time (s)")
plt.ylabel("Amplitude (Hz)")
plt.title('Plot of sin(x) and cos(x)')

# Display the plot
plt.show()
"""


async def test_line_chart(async_sandbox: AsyncSandbox):
    result = await async_sandbox.run_code(code)

    chart = result.results[0].chart
    assert chart

    assert isinstance(chart, LineChart)
    assert chart.title == "Plot of sin(x) and cos(x)"

    assert chart.x_label == "Time (s)"
    assert chart.y_label == "Amplitude (Hz)"

    assert chart.x_unit == "s"
    assert chart.y_unit == "Hz"

    assert chart.x_scale == "datetime"
    assert chart.y_scale == "linear"

    assert all(isinstance(x, str) for x in chart.x_ticks)
    parsed_date = datetime.datetime.fromisoformat(chart.x_ticks[0])
    assert isinstance(parsed_date, datetime.datetime)
    assert all(isinstance(y, float) for y in chart.y_ticks)

    assert all(isinstance(x, str) for x in chart.y_tick_labels)
    assert all(isinstance(y, str) for y in chart.y_tick_labels)

    lines = chart.elements
    assert len(lines) == 2

    first_line = lines[0]
    assert first_line.label == "sin(x)"
    assert len(first_line.points) == 100
    assert all(isinstance(point, tuple) for point in first_line.points)
    assert all(
        isinstance(x, str) and isinstance(y, float) for x, y in first_line.points
    )

    parsed_date = datetime.datetime.fromisoformat(first_line.points[0][0])
    assert isinstance(parsed_date, datetime.datetime)

    second_line = lines[1]
    assert second_line.label == "cos(x)"
    assert len(second_line.points) == 100
