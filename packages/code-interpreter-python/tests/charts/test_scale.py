from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.charts import LineChart


async def test_datetime_scale(async_sandbox: AsyncSandbox):
    code = """
    import numpy as np
    import matplotlib.pyplot as plt
    import datetime

    # Generate x values
    dates = [datetime.date(2023, 9, 1) + datetime.timedelta(seconds=i) for i in range(100)]
    y_sin = np.sin(np.linspace(0, 2*np.pi, 100))

    # Create the plot
    plt.figure(figsize=(10, 6))
    plt.plot(dates, y_sin, label='sin(x)')
    plt.show()
    """

    result = await async_sandbox.run_code(code)

    chart = result.results[0].chart
    assert chart

    assert isinstance(chart, LineChart)
    assert chart.x_scale == "datetime"
    assert chart.y_scale == "linear"


async def test_categorical_scale(async_sandbox: AsyncSandbox):
    code = """
    import numpy as np
    import matplotlib.pyplot as plt

    x = [1, 2, 3, 4, 5]
    y = ['A', 'B', 'C', 'D', 'E']

    # Create the plot
    plt.figure(figsize=(10, 6))
    plt.plot(x, y)
    plt.show()
    """

    result = await async_sandbox.run_code(code)

    chart = result.results[0].chart
    assert chart

    assert isinstance(chart, LineChart)
    assert chart.x_scale == "linear"
    assert chart.y_scale == "categorical"
