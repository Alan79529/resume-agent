import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIR = ROOT / "python"
sys.path.insert(0, str(PYTHON_DIR))

from server import send_response


class AsciiStdout(io.StringIO):
    def write(self, value):
        value.encode("ascii")
        return super().write(value)


class ServerResponseTest(unittest.TestCase):
    def test_send_response_escapes_non_ascii_for_ascii_stdout(self):
        stdout = AsciiStdout()

        with patch("sys.stdout", stdout):
            send_response({"id": "1", "result": {"title": "算法\u2002实习"}})

        payload = stdout.getvalue().strip()
        self.assertIn("\\u2002", payload)
        self.assertEqual(json.loads(payload)["result"]["title"], "算法\u2002实习")


if __name__ == "__main__":
    unittest.main()
