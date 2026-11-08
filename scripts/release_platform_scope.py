"""Explicit delivery scopes; omitted scope preserves the full release contract."""
from __future__ import annotations

from collections.abc import Mapping, Sequence

SCOPES = ("all", "windows")
WINDOWS_PLATFORMS = ("win32-x64", "win32-arm64")


def validate(platform_scope: str) -> str:
    if platform_scope not in SCOPES:
        raise ValueError("release platform_scope must be all or windows")
    return platform_scope


def platforms(platform_scope: str, full: Sequence[str]) -> tuple[str, ...]:
    return tuple(full) if validate(platform_scope) == "all" else WINDOWS_PLATFORMS


def installers(platform_scope: str, full: Mapping[str, tuple[str, str]]) -> dict[str, tuple[str, str]]:
    if validate(platform_scope) == "all":
        return dict(full)
    return {f"{platform}-exe": full[f"{platform}-exe"] for platform in WINDOWS_PLATFORMS}


def metadata(platform_scope: str) -> dict[str, str]:
    return {} if validate(platform_scope) == "all" else {"platform_scope": "windows"}


def require_metadata(value: Mapping[str, object], expected: str) -> None:
    validate(expected)
    if value.get("platform_scope", "all") != expected:
        raise ValueError("release metadata platform scope differs from the reviewed delivery scope")
    if expected == "all" and "platform_scope" in value:
        raise ValueError("full release metadata retains its original field contract")
