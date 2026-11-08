from __future__ import annotations

import copy
import ctypes
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from scripts.diagnostics import windows_v055_acl_observer as observer


def projected_fixture():
    return {
        "schema_version": 1,
        "token": {"user": "current_user", "owner": "administrators", "completed_stages": [], "failure": None},
        "state_files": {name: {"exists": False, "win32_error": 2}
                        for name in ("environment_manifest", "package_journal")},
        "objects": [{"role": role, "directory": index < 2, "completed_stages": [], "failure": None,
                     "capture": None, "decoded": None, "sddl_capacity": None, "sddl_units": None,
                     "aces": [], "writer_policy": "not_reached", "first_rejected_ace": None}
                    for index, role in enumerate(observer.ROLES)],
    }


def ace(principal="current_user", flags=0, kind=0, mask=0x1F01FF, size=20):
    return {"type": kind, "flags": flags, "size": size, "mask": mask,
            "write_mask": mask & observer.WRITE_MASK, "principal": principal, "inherit_only": bool(flags & 8)}


class SecurityProjectionTests(unittest.TestCase):
    def test_owner_rights_is_distinct_from_user_and_creator_owner(self):
        self.assertEqual(observer.principal("S-1-3-4", "S-1-5-21-123"), "owner_rights")
        self.assertEqual(observer.principal("S-1-3-0", "S-1-5-21-123"), "creator_owner")
        self.assertEqual(observer.principal("S-1-5-21-123", "S-1-5-21-123"), "current_user")
        for directory in (False, True):
            self.assertEqual(observer.writer_rejection(ace("owner_rights"), directory), "foreign_writer")

    def test_writer_policy_retains_exact_inheritance_deny_and_unknown_rules(self):
        for role in ("current_user", "administrators", "system"):
            self.assertIsNone(observer.writer_rejection(ace(role), True))
        self.assertIsNone(observer.writer_rejection(ace("other", mask=0x1200A9), True))
        self.assertIsNone(observer.writer_rejection(ace("other", kind=1), True))
        self.assertIsNone(observer.writer_rejection(ace("other", flags=8), False))
        self.assertEqual(observer.writer_rejection(ace("other", flags=8), True), "foreign_writer")
        self.assertIsNone(observer.writer_rejection(ace("creator_owner", flags=8), True))
        self.assertEqual(observer.writer_rejection(ace("creator_owner"), True), "foreign_writer")
        self.assertEqual(observer.writer_rejection(ace(kind=5, mask=0), True), "unknown_ace")
        self.assertEqual(observer.writer_rejection(ace(size=8), True), "unknown_ace")

    def test_utf16_reader_stops_at_nul_and_rejects_unterminated_or_invalid(self):
        padded = (observer.U16 * 5)(ord("O"), ord(":"), 0, 0xD800, 0xFFFF)
        self.assertEqual(observer.read_utf16_prefix(ctypes.addressof(padded), 5, "sddl_text"), ("O:", 2))
        for units in ((1, 2), (0,), (0xD800, 0)):
            buffer = (observer.U16 * len(units))(*units)
            with self.subTest(units=units), self.assertRaises(observer.ObservationFailure):
                observer.read_utf16_prefix(ctypes.addressof(buffer), len(units), "sddl_text")
        for pointer, capacity in ((0, 1), (ctypes.addressof(padded), 65537), (ctypes.addressof(padded), 0)):
            with self.subTest(capacity=capacity), self.assertRaises(observer.ObservationFailure):
                observer.read_utf16_prefix(pointer, capacity, "sddl_text")

    def test_projection_has_only_fixed_roles_and_no_private_fields(self):
        value = projected_fixture()
        value["objects"][0].update(aces=[ace("owner_rights", flags=19)], writer_policy="rejected",
            first_rejected_ace=0, failure={"stage": "writers_policy", "reason": "foreign_writer", "win32_error": 0})
        self.assertEqual(observer.project_observation(value), value)
        for key in ("path", "sid", "sddl", "raw_output"):
            bad = copy.deepcopy(value)
            bad["objects"][0][key] = "PRIVATE_DATA"
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "security_projection"):
                observer.project_observation(bad)
        self.assertNotIn("S-1-", json.dumps(value))

    def test_projection_bounds_every_native_integer_array_and_role(self):
        for change in (
            lambda v: v["objects"][0].update(role="PRIVATE_PATH"),
            lambda v: v["objects"][0].update(aces=[ace()] * 33),
            lambda v: v["objects"][0].update(failure={"stage": "open", "reason": "win32_api", "win32_error": -1}),
            lambda v: v["objects"][0].update(failure={"stage": "PRIVATE", "reason": "win32_api", "win32_error": 1}),
            lambda v: v["objects"][0].update(sddl_capacity=65537),
            lambda v: v["objects"][0].update(aces=[ace("S-1-5-21-123")]),
            lambda v: v["objects"].pop(),
        ):
            value = projected_fixture()
            change(value)
            with self.assertRaisesRegex(ValueError, "security_projection"):
                observer.project_observation(value)

    def test_token_failure_preserves_fixed_stage_without_file_claims(self):
        value = projected_fixture()
        value["token"].update(user=None, owner=None,
                              failure={"stage": "token_open", "reason": "win32_api", "win32_error": 5})
        value["objects"] = []
        self.assertEqual(observer.project_observation(value), value)

    def test_native_signatures_and_open_access_are_read_only(self):
        kernel, security = mock.MagicMock(), mock.MagicMock()
        with mock.patch.object(observer.os, "name", "nt"), mock.patch.object(
                observer.C, "WinDLL", side_effect=(kernel, security), create=True):
            native = observer.NativeSecurity()
        self.assertEqual(observer.READ_ACCESS, 0x20080)
        self.assertEqual(observer.READ_SHARING, 3)
        self.assertEqual(observer.OPEN_FLAGS, 0x02200080)
        self.assertEqual(len(native.functions["CreateFileW"].argtypes), 7)
        self.assertIs(native.functions["GetSecurityInfo"].restype, observer.U32)
        self.assertEqual(len(native.functions["GetSecurityInfo"].argtypes), 8)
        self.assertEqual(ctypes.sizeof(observer.ACL), 8)
        self.assertEqual(ctypes.sizeof(observer.ACE_HEADER), 4)
        self.assertFalse(any(name.startswith(("Set", "Adjust", "Write", "CreateDirectory")) for name in native.functions))

    def test_open_sharing_and_security_info_errors_are_distinct_and_close_handle(self):
        for opened, error, stage in ((observer.PTR(-1).value, 32, "open"), (123, 5, "get_security_info")):
            native = observer.NativeSecurity.__new__(observer.NativeSecurity)
            calls = []
            def call(name, *args):
                calls.append((name, args))
                return {"CreateFileW": opened, "GetSecurityInfo": error, "CloseHandle": 1}[name]
            native.call = call
            with mock.patch.object(observer.C, "get_last_error", return_value=error, create=True):
                value = native.object("cli", Path("owned-fixture"), False, "S-1-5-21-123")
            self.assertEqual(value["failure"], {"stage": stage, "reason": "win32_api", "win32_error": error})
            self.assertEqual(sum(name == "CloseHandle" for name, _ in calls), int(stage != "open"))
            self.assertEqual(calls[0][1][1:6], (observer.READ_ACCESS, 3, None, 3, observer.OPEN_FLAGS))

    @unittest.skipUnless(os.name == "nt", "native Win32 read-only fixture requires Windows")
    def test_native_capture_decode_projects_all_six_owned_objects(self):
        # Creation is fixture setup, not part of the observer. No ACL setters or
        # repairs: retain mkdtemp's real native ACL, including OWNER RIGHTS.
        with tempfile.TemporaryDirectory(prefix="webcodex-acl-observer-") as directory:
            root = Path(directory)
            runtime = root / "webcodex-runtime"
            runtime.mkdir()
            for path in (runtime / "webcodex.exe", runtime / "webcodex-server.exe",
                         runtime / "webcodex-runner.exe", root / "WebCodex.exe"):
                path.write_bytes(b"owned observer fixture")
            result = observer.observe(runtime, root / "no-environment")
            self.assertIsNone(result["token"]["failure"])
            self.assertEqual(len(result["objects"]), 6)
            for obj in result["objects"]:
                self.assertIsNotNone(obj["capture"], obj)
                self.assertIsNotNone(obj["decoded"], obj)
                self.assertIn(obj["writer_policy"], ("accepted", "rejected"), obj)
                if obj["failure"]:
                    self.assertEqual(obj["failure"]["stage"], "writers_policy", obj)
            self.assertNotIn(str(root), json.dumps(result))
            self.assertNotIn("S-1-", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
