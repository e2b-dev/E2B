import asyncio
from init import main as init_main
from fs_ls import main as fs_ls_main
from fs_mkdir import main as fs_mkdir_main
from fs_read import main as fs_read_main
from fs_write import main as fs_write_main
from fs_watch import main as fs_watch_main
from process_start import main as process_start_main
from process_stop import main as process_stop_main
from process_stream_stderr import main as process_stream_stderr_main
from process_stream_stdout import main as process_stream_stdout_main
from process_write_stdin import main as process_write_stdin_main

async def main():
  tasks = [
    fs_ls_main(),
    init_main(),
    fs_mkdir_main(),
    fs_read_main(),
    fs_write_main(),
    fs_watch_main(),
    process_start_main(),
    process_stop_main(),
    process_stream_stderr_main(),
    process_stream_stdout_main(),
    process_write_stdin_main()
  ]
  await asyncio.gather(*tasks)

asyncio.run(main())
