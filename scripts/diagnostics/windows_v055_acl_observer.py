"""Read-only native projection of S60 installer security checks.

This module is diagnostic-only. It never admits an installation or changes a
security descriptor. SID/SDDL/path values stay inside this process. An error of
zero means a validation failed without a documented Win32 last-error value.
"""
from __future__ import annotations

import ctypes as C
import json
import os
from pathlib import Path

MAX_DESCRIPTOR = 65536
MAX_ACES = 32
MAX_OBSERVATION_BYTES = 40 * 1024
WRITE_MASK = 0x500D0156
READ_ACCESS = 0x00020080  # READ_CONTROL | FILE_READ_ATTRIBUTES
READ_SHARING = 0x00000003  # FILE_SHARE_READ | FILE_SHARE_WRITE
OPEN_FLAGS = 0x02200080  # OPEN_REPARSE_POINT | BACKUP_SEMANTICS | Rust OpenOptions' NORMAL attribute
ROLES = ("install_root", "runtime", "cli", "server", "runner", "desktop")
PRINCIPALS = ("current_user", "administrators", "system", "creator_owner", "owner_rights", "other")
REASONS = ("win32_api", "null_pointer", "sid_invalid", "sid_text", "descriptor_bound",
           "descriptor_text", "dacl_absent", "null_dacl", "acl_invalid", "acl_bound",
           "ace_bound", "ace_count_bound", "owner_changed", "protection_changed",
           "group_present", "sacl_present", "unknown_ace", "foreign_writer", "observer_exception")
TOKEN_STAGES = ("token_open", "token_user_size", "token_user_read", "token_user_sid_valid",
                "token_user_sid_string", "token_owner_size", "token_owner_read",
                "token_owner_sid_valid", "token_owner_sid_string")
INSPECT_STAGES = ("owner", "dacl", "acl_valid", "control", "owner_sid_valid", "owner_sid_string")
OBJECT_STAGES = ("open", "get_security_info", "to_sddl", "sddl_text", "from_sddl", "decode_match",
                 "decode_group", "decode_sacl", "writers_dacl", "writers_ace", "writers_sid_valid",
                 "writers_sid_string", "writers_policy", "observer") + tuple(
    prefix + "_" + suffix for prefix in ("capture", "decode") for suffix in INSPECT_STAGES)

U8, U16, U32, BOOL, PTR = C.c_uint8, C.c_uint16, C.c_uint32, C.c_int32, C.c_void_p
PPTR = C.POINTER(PTR)


class ACL(C.Structure):
    _fields_ = [("revision", U8), ("reserved", U8), ("size", U16), ("count", U16), ("reserved2", U16)]


class ACE_HEADER(C.Structure):
    _fields_ = [("type", U8), ("flags", U8), ("size", U16)]


class ObservationFailure(Exception):
    def __init__(self, stage: str, reason: str, error: int = 0):
        self.value = {"stage": stage, "reason": reason, "win32_error": error & 0xFFFFFFFF}


def principal(sid: str, user: str) -> str:
    if sid == user:
        return "current_user"
    return {"S-1-5-32-544": "administrators", "S-1-5-18": "system",
            "S-1-3-0": "creator_owner", "S-1-3-4": "owner_rights"}.get(sid, "other")


def writer_rejection(ace: dict, directory: bool) -> str | None:
    """Mirror check_writers ordering, including its deliberate unknown-ACE rule."""
    if (not directory and ace["inherit_only"]) or ace["type"] == 1:
        return None
    if ace["type"] != 0 or ace["size"] < 12:
        return "unknown_ace"
    if not ace["write_mask"]:
        return None
    if ace["principal"] in ("current_user", "administrators", "system"):
        return None
    if directory and ace["inherit_only"] and ace["principal"] == "creator_owner":
        return None
    return "foreign_writer"


def read_utf16_prefix(pointer: int, capacity: int, stage: str) -> tuple[str, int]:
    if not pointer or not 0 < capacity <= MAX_DESCRIPTOR:
        raise ObservationFailure(stage, "descriptor_bound")
    units = C.cast(pointer, C.POINTER(U16))
    raw = bytearray()
    for index in range(capacity):
        unit = units[index]
        if unit == 0:
            if not raw:
                break
            try:
                return raw.decode("utf-16-le", errors="strict"), index
            except UnicodeError:
                break
        raw.extend(int(unit).to_bytes(2, "little"))
    raise ObservationFailure(stage, "descriptor_text")


def _integer(value, maximum=0xFFFFFFFF) -> bool:
    return type(value) is int and 0 <= value <= maximum


def _failure(value, stages) -> bool:
    return value is None or (type(value) is dict and set(value) == {"stage", "reason", "win32_error"}
        and value["stage"] in stages and value["reason"] in REASONS and _integer(value["win32_error"]))


def _descriptor(value) -> bool:
    return value is None or (type(value) is dict and set(value) == {
        "owner", "control", "revision", "dacl_protected", "acl_revision", "ace_count"}
        and value["owner"] in PRINCIPALS and _integer(value["control"], 65535)
        and _integer(value["revision"]) and type(value["dacl_protected"]) is bool
        and _integer(value["acl_revision"], 255) and _integer(value["ace_count"], 65535))


def project_observation(value: dict) -> dict:
    """Refuse unbounded or unrecognized output before it enters any report."""
    def check(condition):
        if not condition:
            raise ValueError("security_projection")
    check(type(value) is dict and set(value) == {"schema_version", "token", "state_files", "objects"})
    check(type(value["schema_version"]) is int and value["schema_version"] == 1)
    token = value["token"]
    check(type(token) is dict and set(token) == {"user", "owner", "completed_stages", "failure"})
    check(token["user"] in (None, "current_user") and token["owner"] in (None, *PRINCIPALS))
    check(type(token["completed_stages"]) is list and len(token["completed_stages"]) <= len(TOKEN_STAGES)
          and all(stage in TOKEN_STAGES for stage in token["completed_stages"]))
    check(_failure(token["failure"], TOKEN_STAGES + ("observer",)))
    states = value["state_files"]
    check(type(states) is dict and set(states) == {"environment_manifest", "package_journal"})
    for state in states.values():
        check(type(state) is dict and set(state) == {"exists", "win32_error"}
              and (state["exists"] is None or type(state["exists"]) is bool) and _integer(state["win32_error"]))
    objects = value["objects"]
    check(type(objects) is list and len(objects) == (0 if token["failure"] else len(ROLES)))
    for index, obj in enumerate(objects):
        check(type(obj) is dict and set(obj) == {"role", "directory", "completed_stages", "failure", "capture",
              "decoded", "sddl_capacity", "sddl_units", "aces", "writer_policy", "first_rejected_ace"})
        check(obj["role"] == ROLES[index] and type(obj["directory"]) is bool and obj["directory"] == (index < 2))
        check(type(obj["completed_stages"]) is list and len(obj["completed_stages"]) <= 32 + 3 * MAX_ACES
              and all(stage in OBJECT_STAGES for stage in obj["completed_stages"]))
        check(_failure(obj["failure"], OBJECT_STAGES) and _descriptor(obj["capture"]) and _descriptor(obj["decoded"]))
        for key in ("sddl_capacity", "sddl_units"):
            check(obj[key] is None or _integer(obj[key], MAX_DESCRIPTOR))
        check(obj["writer_policy"] in ("not_reached", "accepted", "rejected"))
        check(obj["first_rejected_ace"] is None or _integer(obj["first_rejected_ace"], MAX_ACES - 1))
        check(type(obj["aces"]) is list and len(obj["aces"]) <= MAX_ACES)
        for ace in obj["aces"]:
            check(type(ace) is dict and set(ace) == {"type", "flags", "size", "mask", "write_mask", "principal", "inherit_only"})
            check(_integer(ace["type"], 255) and _integer(ace["flags"], 255) and _integer(ace["size"], 65535)
                  and (ace["mask"] is None or _integer(ace["mask"]))
                  and (ace["write_mask"] is None or _integer(ace["write_mask"]))
                  and ace["principal"] in (None, *PRINCIPALS) and type(ace["inherit_only"]) is bool
                  and ace["inherit_only"] == bool(ace["flags"] & 8))
    check(len(json.dumps(value, separators=(",", ":")).encode()) <= MAX_OBSERVATION_BYTES)
    return value


class NativeSecurity:
    def __init__(self):
        if os.name != "nt":
            raise RuntimeError("native_windows_required")
        self.kernel = C.WinDLL("kernel32", use_last_error=True)
        self.security = C.WinDLL("advapi32", use_last_error=True)
        self.functions = {}
        self._declare(self.kernel, "GetCurrentProcess", [], PTR)
        self._declare(self.kernel, "CloseHandle", [PTR], BOOL)
        self._declare(self.kernel, "LocalFree", [PTR], PTR)
        self._declare(self.kernel, "CreateFileW", [C.c_wchar_p, U32, U32, PTR, U32, U32, PTR], PTR)
        self._declare(self.kernel, "GetFileAttributesW", [C.c_wchar_p], U32)
        self._declare(self.security, "OpenProcessToken", [PTR, U32, PPTR], BOOL)
        self._declare(self.security, "GetTokenInformation", [PTR, C.c_int32, PTR, U32, C.POINTER(U32)], BOOL)
        self._declare(self.security, "GetSecurityInfo", [PTR, C.c_int32, U32, PPTR, PPTR, PPTR, PPTR, PPTR], U32)
        self._declare(self.security, "GetSecurityDescriptorOwner", [PTR, PPTR, C.POINTER(BOOL)], BOOL)
        self._declare(self.security, "GetSecurityDescriptorDacl", [PTR, C.POINTER(BOOL), PPTR, C.POINTER(BOOL)], BOOL)
        self._declare(self.security, "GetSecurityDescriptorControl", [PTR, C.POINTER(U16), C.POINTER(U32)], BOOL)
        self._declare(self.security, "GetSecurityDescriptorGroup", [PTR, PPTR, C.POINTER(BOOL)], BOOL)
        self._declare(self.security, "GetSecurityDescriptorSacl", [PTR, C.POINTER(BOOL), PPTR, C.POINTER(BOOL)], BOOL)
        self._declare(self.security, "IsValidAcl", [PTR], BOOL)
        self._declare(self.security, "IsValidSid", [PTR], BOOL)
        self._declare(self.security, "ConvertSidToStringSidW", [PTR, PPTR], BOOL)
        self._declare(self.security, "ConvertSecurityDescriptorToStringSecurityDescriptorW", [PTR, U32, U32, PPTR, C.POINTER(U32)], BOOL)
        self._declare(self.security, "ConvertStringSecurityDescriptorToSecurityDescriptorW", [C.c_wchar_p, U32, PPTR, C.POINTER(U32)], BOOL)
        self._declare(self.security, "GetAce", [PTR, U32, PPTR], BOOL)

    def _declare(self, dll, name, args, result):
        function = getattr(dll, name)
        function.argtypes, function.restype = args, result
        self.functions[name] = function

    def call(self, name, *args):
        C.set_last_error(0)
        return self.functions[name](*args)

    def boolean(self, stages, stage, name, *args):
        if not self.call(name, *args):
            raise ObservationFailure(stage, "win32_api", C.get_last_error())
        stages.append(stage)

    def sid(self, pointer, stages, prefix):
        if not pointer:
            raise ObservationFailure(prefix + "_valid", "null_pointer")
        self.boolean(stages, prefix + "_valid", "IsValidSid", pointer)
        text = PTR()
        self.boolean(stages, prefix + "_string", "ConvertSidToStringSidW", pointer, C.byref(text))
        try:
            return read_utf16_prefix(text.value, 256, prefix + "_string")[0]
        finally:
            if text.value:
                self.call("LocalFree", text)

    def token(self, report):
        handle = PTR()
        stages = report["completed_stages"]
        self.boolean(stages, "token_open", "OpenProcessToken", self.call("GetCurrentProcess"), 8, C.byref(handle))
        try:
            identities = []
            for label, kind in (("user", 1), ("owner", 4)):
                prefix = "token_" + label
                needed = U32()
                result = self.call("GetTokenInformation", handle, kind, None, 0, C.byref(needed))
                error = C.get_last_error()
                if result or error != 122 or not C.sizeof(PTR) <= needed.value <= MAX_DESCRIPTOR:
                    raise ObservationFailure(prefix + "_size", "descriptor_bound", error)
                stages.append(prefix + "_size")
                buffer = (C.c_uint64 * ((needed.value + 7) // 8))()
                self.boolean(stages, prefix + "_read", "GetTokenInformation", handle, kind, buffer, needed, C.byref(needed))
                sid = self.sid(C.cast(buffer, C.POINTER(PTR))[0], stages, prefix + "_sid")
                identities.append(sid)
                report[label] = principal(sid, identities[0])
            return identities[0]
        finally:
            self.call("CloseHandle", handle)

    def inspect(self, descriptor, stages, prefix, user):
        owner, acl = PTR(), PTR()
        defaulted, present = BOOL(), BOOL()
        control, revision = U16(), U32()
        self.boolean(stages, prefix + "_owner", "GetSecurityDescriptorOwner", descriptor, C.byref(owner), C.byref(defaulted))
        self.boolean(stages, prefix + "_dacl", "GetSecurityDescriptorDacl", descriptor, C.byref(present), C.byref(acl), C.byref(defaulted))
        if not present.value or not acl.value:
            raise ObservationFailure(prefix + "_dacl", "null_dacl" if present.value else "dacl_absent")
        self.boolean(stages, prefix + "_acl_valid", "IsValidAcl", acl)
        self.boolean(stages, prefix + "_control", "GetSecurityDescriptorControl", descriptor, C.byref(control), C.byref(revision))
        identity = self.sid(owner, stages, prefix + "_owner_sid")
        header = C.cast(acl, C.POINTER(ACL)).contents
        summary = {"owner": principal(identity, user), "control": control.value, "revision": revision.value,
                   "dacl_protected": bool(control.value & 0x1000), "acl_revision": header.revision, "ace_count": header.count}
        return identity, summary

    def writers(self, descriptor, directory, user, obj):
        acl, present, defaulted = PTR(), BOOL(), BOOL()
        stages = obj["completed_stages"]
        self.boolean(stages, "writers_dacl", "GetSecurityDescriptorDacl", descriptor, C.byref(present), C.byref(acl), C.byref(defaulted))
        if not present.value or not acl.value:
            raise ObservationFailure("writers_dacl", "null_dacl" if present.value else "dacl_absent")
        header = C.cast(acl, C.POINTER(ACL)).contents
        if header.size < C.sizeof(ACL):
            raise ObservationFailure("writers_dacl", "acl_bound")
        if header.count > MAX_ACES:
            raise ObservationFailure("writers_ace", "ace_count_bound")
        for index in range(header.count):
            pointer = PTR()
            self.boolean(stages, "writers_ace", "GetAce", acl, index, C.byref(pointer))
            if not pointer.value or not acl.value + C.sizeof(ACL) <= pointer.value <= acl.value + header.size - 4:
                raise ObservationFailure("writers_ace", "ace_bound")
            ace = C.cast(pointer, C.POINTER(ACE_HEADER)).contents
            if ace.size < 4 or pointer.value + ace.size > acl.value + header.size:
                raise ObservationFailure("writers_ace", "ace_bound")
            item = {"type": ace.type, "flags": ace.flags, "size": ace.size, "mask": None,
                    "write_mask": None, "principal": None, "inherit_only": bool(ace.flags & 8)}
            # Plain allow/deny ACEs have the same fixed mask + SID layout.
            if ace.type in (0, 1) and ace.size >= 12:
                item["mask"] = C.cast(pointer.value + 4, C.POINTER(U32))[0]
                item["write_mask"] = item["mask"] & WRITE_MASK
                available = ace.size - 8
                sid_length = 8 + 4 * C.cast(pointer.value + 9, C.POINTER(U8))[0]
                if sid_length > available:
                    raise ObservationFailure("writers_sid_valid", "sid_invalid")
                identity = self.sid(pointer.value + 8, stages, "writers_sid")
                item["principal"] = principal(identity, user)
            obj["aces"].append(item)
            rejection = writer_rejection(item, directory)
            if rejection and obj["first_rejected_ace"] is None:
                obj["first_rejected_ace"] = index
                obj["failure"] = {"stage": "writers_policy", "reason": rejection, "win32_error": 0}
        obj["writer_policy"] = "rejected" if obj["first_rejected_ace"] is not None else "accepted"
        stages.append("writers_policy")

    def object(self, role, path, directory, user):
        obj = {"role": role, "directory": directory, "completed_stages": [], "failure": None, "capture": None,
               "decoded": None, "sddl_capacity": None, "sddl_units": None, "aces": [],
               "writer_policy": "not_reached", "first_rejected_ace": None}
        handle = None
        descriptor, text, decoded = PTR(), PTR(), PTR()
        stages = obj["completed_stages"]
        try:
            handle = self.call("CreateFileW", str(path), READ_ACCESS, READ_SHARING, None, 3, OPEN_FLAGS, None)
            if handle == PTR(-1).value or handle is None:
                raise ObservationFailure("open", "win32_api", C.get_last_error())
            stages.append("open")
            code = self.call("GetSecurityInfo", handle, 1, 5, None, None, None, None, C.byref(descriptor))
            if code:
                raise ObservationFailure("get_security_info", "win32_api", code)
            if not descriptor.value:
                raise ObservationFailure("get_security_info", "null_pointer")
            stages.append("get_security_info")
            owner, obj["capture"] = self.inspect(descriptor, stages, "capture", user)
            capacity = U32()
            self.boolean(stages, "to_sddl", "ConvertSecurityDescriptorToStringSecurityDescriptorW", descriptor, 1, 5, C.byref(text), C.byref(capacity))
            obj["sddl_capacity"] = capacity.value if capacity.value <= MAX_DESCRIPTOR else None
            sddl, obj["sddl_units"] = read_utf16_prefix(text.value, capacity.value, "sddl_text")
            stages.append("sddl_text")
            if len(sddl.encode("utf-8")) > MAX_DESCRIPTOR:
                raise ObservationFailure("from_sddl", "descriptor_bound")
            self.boolean(stages, "from_sddl", "ConvertStringSecurityDescriptorToSecurityDescriptorW", sddl, 1, C.byref(decoded), None)
            decoded_owner, obj["decoded"] = self.inspect(decoded, stages, "decode", user)
            if owner != decoded_owner:
                raise ObservationFailure("decode_match", "owner_changed")
            if obj["capture"]["dacl_protected"] != obj["decoded"]["dacl_protected"]:
                raise ObservationFailure("decode_match", "protection_changed")
            stages.append("decode_match")
            group, sacl, present, defaulted = PTR(), PTR(), BOOL(), BOOL()
            self.boolean(stages, "decode_group", "GetSecurityDescriptorGroup", decoded, C.byref(group), C.byref(defaulted))
            if group.value:
                raise ObservationFailure("decode_group", "group_present")
            self.boolean(stages, "decode_sacl", "GetSecurityDescriptorSacl", decoded, C.byref(present), C.byref(sacl), C.byref(defaulted))
            if present.value:
                raise ObservationFailure("decode_sacl", "sacl_present")
            self.writers(decoded, directory, user, obj)
        except ObservationFailure as error:
            obj["failure"] = error.value
        except Exception:
            obj["failure"] = {"stage": "observer", "reason": "observer_exception", "win32_error": 0}
        finally:
            for allocation in (decoded, text, descriptor):
                if allocation.value:
                    self.call("LocalFree", allocation)
            if handle is not None and handle != PTR(-1).value:
                self.call("CloseHandle", handle)
        return obj

    def exists(self, path):
        attributes = self.call("GetFileAttributesW", str(path))
        if attributes != 0xFFFFFFFF:
            return {"exists": True, "win32_error": 0}
        error = C.get_last_error()
        return {"exists": False if error in (2, 3) else None, "win32_error": error}


def observe(runtime: Path, environment: Path) -> dict:
    native = NativeSecurity()
    value = {"schema_version": 1, "token": {"user": None, "owner": None, "completed_stages": [], "failure": None},
             "state_files": {"environment_manifest": native.exists(environment / "environment.json"),
                             "package_journal": native.exists(environment / "windows-package-upgrade.json")}, "objects": []}
    try:
        user = native.token(value["token"])
    except ObservationFailure as error:
        value["token"]["failure"] = error.value
        return project_observation(value)
    except Exception:
        value["token"]["failure"] = {"stage": "observer", "reason": "observer_exception", "win32_error": 0}
        return project_observation(value)
    root = runtime.parent
    paths = (root, runtime, runtime / "webcodex.exe", runtime / "webcodex-server.exe",
             runtime / "webcodex-runner.exe", root / "WebCodex.exe")
    value["objects"] = [native.object(role, path, index < 2, user) for index, (role, path) in enumerate(zip(ROLES, paths))]
    return project_observation(value)
