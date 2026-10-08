from harness import CodeInterpreter


def test_display_data(client: CodeInterpreter):
    execution = client.run_code(
        """
        import matplotlib.pyplot as plt
        import numpy as np

        x = np.linspace(0, 20, 100)
        y = np.sin(x)

        plt.plot(x, y)
        plt.show()
        """
    )

    result = execution.results[0]
    assert result.png
    assert result.text
    assert not result.extra


def test_data(client: CodeInterpreter):
    execution = client.run_code(
        """
        import pandas as pd
        pd.DataFrame({"a": [1, 2, 3]})
        """
    )

    result = execution.results[0]
    assert result.data
    assert "a" in result.data
    assert len(result.data["a"]) == 3


def test_custom_repr_object(client: CodeInterpreter):
    execution = client.run_code(
        """
        from IPython.display import display

        display({'text/latex': r'\\text{CustomReprObject}'}, raw=True)
        """
    )

    assert execution.results[0].formats() == ["latex"]
    assert execution.results[0].latex == r"\text{CustomReprObject}"


def test_html_result(client: CodeInterpreter):
    execution = client.run_code(
        """
        from IPython.display import HTML
        HTML('<b>bold</b>')
        """
    )

    result = execution.results[0]
    assert result.html == "<b>bold</b>"
    assert result.is_main_result is True


def test_show_image(client: CodeInterpreter):
    execution = client.run_code(
        """
        import numpy
        from PIL import Image

        imarray = numpy.random.rand(16,16,3) * 255
        image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

        image.show()
        print("Image shown.")
        """
    )

    assert execution.results[0].png


def test_image_as_last_command(client: CodeInterpreter):
    execution = client.run_code(
        """
        import numpy
        from PIL import Image

        imarray = numpy.random.rand(16,16,3) * 255
        image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

        image
        """
    )

    assert execution.results[0].png


def test_get_image_on_save(client: CodeInterpreter):
    execution = client.run_code(
        """
        import numpy
        from PIL import Image

        imarray = numpy.random.rand(16,16,3) * 255
        image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

        image.save("test.png")
        print("Image saved.")
        """
    )

    assert execution.results[0].png
