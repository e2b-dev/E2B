from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.charts import ChartType, BarChart

code = """
import matplotlib.pyplot as plt

# Prepare data
authors = ['Author A', 'Author B', 'Author C', 'Author D']
sales = [100, 200, 300, 400]

# Create and customize the bar chart
plt.figure(figsize=(10, 6))
plt.bar(authors, sales, label='Books Sold', color='blue')
plt.xlabel('Authors')
plt.ylabel('Number of Books Sold')
plt.title('Book Sales by Authors')

# Display the chart
plt.tight_layout()
plt.show()
"""


async def test_chart_bar(async_sandbox: AsyncSandbox):
    result = await async_sandbox.run_code(code)

    chart = result.results[0].chart
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
