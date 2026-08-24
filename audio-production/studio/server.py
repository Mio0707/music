"""Compatibility entry point for the original 4 × 4 music production studio."""

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
    frontend_music_dir=PROJECT_DIR / "prototype" / "assets" / "music",
    demo_dir=PROJECT_DIR / "prototype",
)

Handler = _core.Handler


def __getattr__(name: str):
    return getattr(_core, name)


def main() -> int:
    return _core.run_server(default_port=8765, port_env="MUSIC_STUDIO_PORT")


if __name__ == "__main__":
    raise SystemExit(main())
