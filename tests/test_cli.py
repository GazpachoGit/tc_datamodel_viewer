from contextlib import redirect_stdout
from datetime import datetime
from io import StringIO
from pathlib import Path
from shutil import copyfile
import sys
import tempfile
import unittest
from unittest.mock import patch

from tc_to_plantuml.cli import main


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"
MAPPING = ROOT / "spec" / "mapping.yaml"


class CliTests(unittest.TestCase):
    def test_converts_xml_files_into_expected_output_and_overwrites(self):
        # The CLI combines XML, skips subdirectories, and overwrites the output.
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            for path in (FIXTURES / "xml").glob("*.xml"):
                copyfile(path, directory / path.name)
            nested = directory / "nested"
            nested.mkdir()
            copyfile(FIXTURES / "xml" / "01_classes.xml", nested / "ignored.xml")
            output = directory / "model_20261124_102700.puml"
            output.write_text("old output", encoding="utf-8")
            stdout = StringIO()
            args = ["tc-to-plantuml", str(directory), "--mapping", str(MAPPING)]

            with patch.object(sys, "argv", args), patch("tc_to_plantuml.cli.datetime") as clock:
                clock.now.return_value = datetime(2026, 11, 24, 10, 27, 0)
                with redirect_stdout(stdout):
                    result = main()

            self.assertEqual(result, 0)
            self.assertEqual(stdout.getvalue().strip(), str(output))
            self.assertEqual(
                output.read_text(encoding="utf-8"),
                (FIXTURES / "expected" / "model.puml").read_text(encoding="utf-8"),
            )


if __name__ == "__main__":
    unittest.main()
