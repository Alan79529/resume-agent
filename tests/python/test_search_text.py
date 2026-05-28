import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIR = ROOT / "python"
sys.path.insert(0, str(PYTHON_DIR))

from tools.search_text import sanitize_search_text


class SearchTextTest(unittest.TestCase):
    def test_sanitize_search_text_removes_unpaired_surrogates(self):
        value = "Python后端\udca0北京"

        self.assertEqual(sanitize_search_text(value), "Python后端北京")

    def test_sanitize_search_text_normalizes_whitespace(self):
        value = "  Python\u00a0 后端\t北京  "

        self.assertEqual(sanitize_search_text(value), "Python 后端 北京")

    def test_sanitize_search_text_repairs_common_utf8_as_gbk_mojibake(self):
        value = "澶фā鍨嬪紑鍙 瀹炰範"

        self.assertEqual(sanitize_search_text(value), "大模型开发 实习")

    def test_sanitize_search_text_repairs_truncated_internship_suffix(self):
        value = "大模型开发实"

        self.assertEqual(sanitize_search_text(value), "大模型开发实习")


if __name__ == "__main__":
    unittest.main()
