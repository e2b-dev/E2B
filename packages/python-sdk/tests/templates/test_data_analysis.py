from e2b.templates.data_analysis import DataAnalysis


def test_create_graph():
    s = DataAnalysis()
    a, b, artifacts = s.run_python(
        """
import matplotlib.pyplot as plt

plt.plot([1, 2, 3, 4])
plt.ylabel('some numbers')
plt.show()
    """
    )
    s.close()
    assert len(artifacts) == 1
