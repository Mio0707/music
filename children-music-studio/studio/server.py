"""Compatibility entry point for the children's music design studio."""

from __future__ import annotations

import sys
from pathlib import Path


STUDIO_DIR = Path(__file__).resolve().parent
PROJECT_DIR = STUDIO_DIR.parents[1]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from music_studio_common import server as _core  # noqa: E402


_core.configure_workspace(
    studio_dir=STUDIO_DIR,
    frontend_music_dir=STUDIO_DIR.parent / "published-music",
    demo_dir=STUDIO_DIR,
)

Handler = _core.Handler
JOBS_DIR = _core.JOBS_DIR
RECORDS_DIR = _core.RECORDS_DIR
FRONTEND_MUSIC_DIR = _core.FRONTEND_MUSIC_DIR


def __getattr__(name: str):
    return getattr(_core, name)


def main() -> int:
    return _core.run_server(default_port=8766, port_env="CHILDREN_MUSIC_STUDIO_PORT")


if __name__ == "__main__":
    raise SystemExit(main())
