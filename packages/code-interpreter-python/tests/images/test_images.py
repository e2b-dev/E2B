from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_show_image(async_sandbox: AsyncSandbox):
    code = """
    import numpy
    from PIL import Image

    imarray = numpy.random.rand(16,16,3) * 255
    image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

    image.show()
    print("Image shown.")
    """

    execution = await async_sandbox.run_code(code)

    image = execution.results[0].png
    assert image


async def test_image_as_last_command(async_sandbox: AsyncSandbox):
    code = """
    import numpy
    from PIL import Image

    imarray = numpy.random.rand(16,16,3) * 255
    image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

    image
    """
    execution = await async_sandbox.run_code(code)

    image = execution.results[0].png
    assert image


async def test_get_image_on_save(async_sandbox: AsyncSandbox):
    code = """
    import numpy
    from PIL import Image

    imarray = numpy.random.rand(16,16,3) * 255
    image = Image.fromarray(imarray.astype('uint8')).convert('RGBA')

    image.save("test.png")
    print("Image saved.")
    """

    execution = await async_sandbox.run_code(code)

    image = execution.results[0].png
    assert image
