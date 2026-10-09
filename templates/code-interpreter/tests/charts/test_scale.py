def test_datetime_scale(run_chart):
    chart = run_chart(
        """
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
    )

    assert chart["type"] == "line"
    assert chart["x_scale"] == "datetime"
    assert chart["y_scale"] == "linear"


def test_categorical_scale(run_chart):
    chart = run_chart(
        """
        import numpy as np
        import matplotlib.pyplot as plt

        x = [1, 2, 3, 4, 5]
        y = ['A', 'B', 'C', 'D', 'E']

        # Create the plot
        plt.figure(figsize=(10, 6))
        plt.plot(x, y)
        plt.show()
        """
    )

    assert chart["type"] == "line"
    assert chart["x_scale"] == "linear"
    assert chart["y_scale"] == "categorical"
