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


def test_install_packages():
    s = DataAnalysis()

    s.install_python_packages("pandas")
    s.install_python_packages(["pandas"])
    s.install_python_packages(" ")
    s.install_python_packages([])

    s.install_system_packages("curl")
    s.install_system_packages(["curl"])
    s.install_system_packages("")
    s.install_system_packages([])
    s.close()
