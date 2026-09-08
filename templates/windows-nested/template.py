"""Build the windows-nested template from a pushed image.

usage: python template.py IMAGE NAME [--mode relaunch|live] [--cpu N] [--memory-mb N] [--skip-cache]

  IMAGE  OCI reference of the image built from e2b.Dockerfile, in a registry the
         template builder can pull from
  NAME   template name (or name:tag)
"""

import argparse
import time

from e2b import Template, wait_for_file

parser = argparse.ArgumentParser(
    description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
)
parser.add_argument("image")
parser.add_argument("name")
parser.add_argument("--mode", choices=["relaunch", "live"], default="relaunch")
parser.add_argument("--cpu", type=int, default=8)
parser.add_argument("--memory-mb", type=int, default=8192)
parser.add_argument("--skip-cache", action="store_true")
args = parser.parse_args()

template = Template().from_image(args.image).set_user("root").set_workdir("/opt/win")
if args.mode == "relaunch":
    template = template.run_cmd("bash /opt/win/build-snapshot.sh").set_start_cmd(
        "python3 /opt/win/winctl.py", wait_for_file("/opt/win/winctl.ready")
    )
else:
    template = template.set_start_cmd(
        "bash /opt/win/start-live.sh", "python3 /opt/win/rdpcheck.py"
    )

t0 = time.monotonic()
info = Template.build(
    template,
    args.name,
    cpu_count=args.cpu,
    memory_mb=args.memory_mb,
    skip_cache=args.skip_cache,
    on_build_logs=lambda entry: print(entry, flush=True),
)
print(
    f"built {args.name} ({args.mode}) template_id={info.template_id} build_id={info.build_id} in {time.monotonic() - t0:.0f}s"
)
