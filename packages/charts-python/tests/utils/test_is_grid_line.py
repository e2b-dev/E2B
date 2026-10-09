from matplotlib.lines import Line2D

from e2b_charts.utils.filtering import is_grid_line


def test_is_grid_line():
    not_a_grid_line = Line2D([1, 2], [2, 3])
    assert not is_grid_line(not_a_grid_line)

    horizontal_grid_line = Line2D([1, 2], [2, 2])
    assert is_grid_line(horizontal_grid_line)

    vertical_grid_line = Line2D([1, 1], [2, 3])
    assert is_grid_line(vertical_grid_line)

    long_line = Line2D([1, 1, 1, 1], [2, 3, 4, 5])
    assert not is_grid_line(long_line)
