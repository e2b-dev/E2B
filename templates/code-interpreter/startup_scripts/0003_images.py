from typing import Any

from IPython.core.display_functions import display
from PIL.Image import Image
from PIL.ImageShow import UnixViewer


def show_file(self, path: str, **options: Any) -> int:
    # To prevent errors from trying to display image without any display
    return 0


UnixViewer.show_file = show_file
original_save = Image.save


def save(image, fp, format=None, **options):
    if isinstance(fp, str):
        display(image)

    original_save(image, fp, format, **options)


Image.save = save
