import unittest
from pathlib import Path

from tc_to_plantuml.reader import load_mapping, read_model


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"
MAPPING = ROOT / "spec" / "mapping.yaml"


class MappingTests(unittest.TestCase):
    def test_load_mapping_preserves_type_array_flag_and_characteristics(self):
        # Mapping rules preserve the type, array flag, and characteristics.
        mappings = load_mapping(MAPPING)

        self.assertEqual(mappings["POM_string"].type, "String")
        self.assertEqual(mappings["POM_string"].array_flag, "isArray")
        self.assertEqual(mappings["POM_string"].chars, ("maxStringLength",))
        self.assertEqual(mappings["POM_date"].chars, ())
        self.assertEqual(mappings["POM_typed_reference"].chars, ("typedRefClassName",))


class ReaderTests(unittest.TestCase):
    def setUp(self):
        self.mappings = load_mapping(MAPPING)

    def test_combines_classes_attributes_and_attachments_from_files(self):
        # Classes, inheritance, and attached attributes are merged from two XML files.
        paths = sorted((FIXTURES / "xml").glob("*.xml"))
        model = read_model(paths, self.mappings)

        self.assertEqual(set(model.classes), {"Child", "Parent", "Root", "External"})
        child = model.classes["Child"]
        self.assertEqual(child.parent, "Parent")
        self.assertEqual(model.classes["Parent"].parent, "Root")
        self.assertIsNone(model.classes["Root"].parent)
        self.assertIsNone(model.classes["External"].parent)
        self.assertEqual(child.attributes["names"].type, "String")
        self.assertTrue(child.attributes["names"].is_array)
        self.assertEqual(child.attributes["names"].chars, {"maxStringLength": "128"})
        self.assertEqual(
            child.attributes["severity"].chars,
            {"lowerBoundValue": "0", "upperBoundValue": "10"},
        )
        self.assertEqual(child.attributes["amount"].chars, {"upperBoundValue": "100"})
        self.assertEqual(child.attributes["approver"].type, "TypedReference")
        self.assertEqual(child.attributes["approver"].chars, {"typedRefClassName": "GroupMember"})
        self.assertIn("note", child.attributes)
        self.assertTrue(child.attributes["releases"].is_array)
        self.assertIn("code", model.classes["Parent"].attributes)
        self.assertIn("owner", model.classes["External"].attributes)


if __name__ == "__main__":
    unittest.main()
