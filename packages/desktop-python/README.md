# E2B Desktop Sandbox - Virtual Computer for Computer Use

E2B Desktop Sandbox is a secure virtual desktop ready for Computer Use. Powered by [E2B](https://e2b.dev).

Each sandbox is isolated from the others and can be customized with any dependencies you want.

![Desktop Sandbox](https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/screenshot.png)

Source: [packages/desktop-python](https://github.com/e2b-dev/E2B/tree/main/packages/desktop-python)

## Examples

Check out the [example open-source app](https://github.com/e2b-dev/open-computer-use) in a separate repository.

## 🚀 Getting started

The E2B Desktop Sandbox is built on top of [E2B Sandbox](https://e2b.dev/docs).

### 1. Get E2B API key

Sign up at [E2B](https://e2b.dev) and get your API key.
Set environment variable `E2B_API_KEY` with your API key.

### 2. Install SDK

```bash
pip install e2b-desktop
```

### 3. Create Desktop Sandbox

```python
from e2b_desktop import Sandbox

# Create a new desktop sandbox
desktop = Sandbox.create()

# Launch an application
desktop.launch('google-chrome')  # or vscode, firefox, etc.

# Wait 10s for the application to open
desktop.wait(10000)

# Stream the application's window
# Note: There can be only one stream at a time
# You need to stop the current stream before streaming another application
desktop.stream.start(
    window_id=desktop.get_current_window_id(), # if not provided the whole desktop will be streamed
    require_auth=True
)

# Get the stream auth key
auth_key = desktop.stream.get_auth_key()

# Print the stream URL
print('Stream URL:', desktop.stream.get_url(auth_key=auth_key))

# Kill the sandbox after the tasks are finished
# desktop.kill()
```

## Features

### Streaming desktop's screen

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Start the stream
desktop.stream.start()

# Get stream URL
url = desktop.stream.get_url()
print(url)

# Stop the stream
desktop.stream.stop()
```

### Streaming with password protection

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Start the stream
desktop.stream.start(
    require_auth=True  # Enable authentication with an auto-generated key
)

# Retrieve the authentication key
auth_key = desktop.stream.get_auth_key()

# Get stream URL
url = desktop.stream.get_url(auth_key=auth_key)
print(url)

# Stop the stream
desktop.stream.stop()
```

### Streaming specific application

> [!WARNING]
>
> - Will raise an error if the desired application is not open yet
> - The stream will close once the application closes
> - Creating multiple streams at the same time is not supported, you may have to stop the current stream and start a new one for each application

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Get current (active) window ID
window_id = desktop.get_current_window_id()

# Get all windows of the application
window_ids = desktop.get_application_windows("Firefox")

# Start the stream
desktop.stream.start(window_id=window_ids[0])

# Stop the stream
desktop.stream.stop()
```

### Mouse control

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

desktop.double_click()
desktop.left_click()
desktop.left_click(x=100, y=200)
desktop.right_click()
desktop.right_click(x=100, y=200)
desktop.middle_click()
desktop.middle_click(x=100, y=200)
desktop.scroll(10) # Scroll by the amount. Positive for up, negative for down.
desktop.move_mouse(100, 200) # Move to x, y coordinates
desktop.drag((100, 100), (200, 200)) # Drag using the mouse
desktop.mouse_press("left") # Press the mouse button
desktop.mouse_release("left") # Release the mouse button
```

### Keyboard control

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Write text at the current cursor position with customizable typing speed
desktop.write("Hello, world!")  # Default: chunk_size=25, delay_in_ms=75
desktop.write("Fast typing!", chunk_size=50, delay_in_ms=25)  # Faster typing

# Press keys
desktop.press("enter")
desktop.press("space")
desktop.press("backspace")
desktop.press(["ctrl", "c"]) # Key combination
```

### Window control

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Get current (active) window ID
window_id = desktop.get_current_window_id()

# Get all windows of the application
window_ids = desktop.get_application_windows("Firefox")

# Get window title
title = desktop.get_window_title(window_id)
```

### Screenshot

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Take a screenshot and save it as "screenshot.png" locally
image = desktop.screenshot()
# Save the image to a file
with open("screenshot.png", "wb") as f:
    f.write(image)
```

### Open file

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Open file with default application
desktop.files.write("/home/user/index.js", "console.log('hello')") # First create the file
desktop.open("/home/user/index.js") # Then open it
```

### Launch applications

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Launch the application
desktop.launch('google-chrome')
```

### Run any bash commands

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

# Run any bash command
out = desktop.commands.run("ls -la /home/user")
print(out)
```

### Wait

```python
from e2b_desktop import Sandbox
desktop = Sandbox.create()

desktop.wait(1000) # Wait for 1 second
```

## Under the hood

The desktop-like environment is based on Linux and [Xfce](https://www.xfce.org/) at the moment. We chose Xfce because it's a fast and lightweight environment that's also popular and actively supported. However, this Sandbox template is fully customizable and you can create your own desktop environment.
Check out the sandbox template's code [here](https://github.com/e2b-dev/desktop/tree/main/template).
