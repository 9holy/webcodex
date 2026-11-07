#!/usr/bin/env python3
"""Build the self-contained Python 3.10+ Codex ACP adapter without dependencies."""
import argparse
import os
from pathlib import Path
import tempfile
import zipfile


SOURCE = Path(__file__).resolve().parents[1] / "integrations" / "codex_app_server"
FILES = ("__main__.py", "adapter.py", "compatibility.py")


def package(destination):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, staging = tempfile.mkstemp(prefix=".codex-adapter-", dir=destination.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(b"#!/usr/bin/env python3\n")
            with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED) as archive:
                for name in FILES:
                    item = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                    item.create_system = 3
                    item.external_attr = 0o100644 << 16
                    archive.writestr(item, (SOURCE / name).read_bytes())
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(staging, 0o755)
        os.replace(staging, destination)
    finally:
        if os.path.exists(staging):
            os.unlink(staging)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    arguments = parser.parse_args()
    print(package(arguments.output))


if __name__ == "__main__":
    main()
