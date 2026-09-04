import time
from e2b_desktop import Sandbox
from PIL import ImageChops, Image
import io


def crop_around_point(image, cursor_pos):
    x, y = cursor_pos
    box = (x - 50, y - 50, x + 50, y + 50)  # 100x100 box
    return image.crop(box)


def images_are_equal(img1, img2):
    # Use ImageChops to find the difference
    diff = ImageChops.difference(img1, img2)
    # Check if there is any difference
    return (
        diff.getbbox() is None
    )  # Returns True if images are equal, False if different


def test_right_click(sandbox: Sandbox):
    # Capture the initial screenshot
    time.sleep(5)  # Wait for UI to load

    initial_screenshot_bytes = sandbox.screenshot()
    initial_image = Image.open(io.BytesIO(initial_screenshot_bytes))

    # Get cursor position and perform right click
    cursor_pos = sandbox.get_cursor_position()
    sandbox.right_click()
    time.sleep(5)  # Wait for UI to respond

    # Capture and process the second screenshot
    post_click_screenshot_bytes = sandbox.screenshot()
    post_click_image = Image.open(io.BytesIO(post_click_screenshot_bytes))

    # Crop both images around the cursor position
    cropped_image_1 = crop_around_point(initial_image, cursor_pos)
    cropped_image_2 = crop_around_point(post_click_image, cursor_pos)

    # Compare the cropped images
    assert not images_are_equal(cropped_image_1, cropped_image_2), (
        "The image around the cursor did not change after right-click."
    )


def test_screenshot(sandbox: Sandbox):
    image = sandbox.screenshot()
    assert image, "Screenshot was not taken successfully"

    # Check if the image is a valid image format
    try:
        img = Image.open(io.BytesIO(image))
        img.verify()  # Verify that it is an image
    except Exception:
        assert False, "The screenshot is not a valid image."


def test_get_cursor_position(sandbox: Sandbox):
    pos = sandbox.get_cursor_position()
    assert pos == (
        512,
        384,
    ), f"Expected cursor position to be (512, 384), but got {pos}"


def test_get_screen_size(sandbox: Sandbox):
    size = sandbox.get_screen_size()
    assert size == (
        1024,
        768,
    ), f"Expected screen size to be (1024, 768), but got {size}"


def test_write(sandbox: Sandbox):
    # Create a file and open it in a text editor
    text_file_path = "/home/user/test.txt"
    sandbox.files.write(text_file_path, "hello")
    sandbox.open(text_file_path)
    # Add an assertion here, perhaps check if the content is correct
    content = sandbox.files.read(text_file_path)
    assert content == "hello", (
        f"Expected content 'hello' in {text_file_path}, but got {content}"
    )
