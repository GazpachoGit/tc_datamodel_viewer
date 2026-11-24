import unittest

from tc_to_plantuml.model import Attribute, Class, Model
from tc_to_plantuml.renderer import render_attribute, render_model


class RendererTests(unittest.TestCase):
    def test_attribute_formats_array_and_characteristics(self):
        # Arrays and characteristics are included in the attribute line.
        attribute = Attribute(
            "severity",
            "Integer",
            True,
            {"lowerBoundValue": "0", "upperBoundValue": "10"},
        )

        self.assertEqual(
            render_attribute(attribute),
            "  severity : Integer[] {lowerBoundValue=0, upperBoundValue=10}",
        )
        self.assertEqual(render_attribute(Attribute("created", "Date", False)), "  created : Date")

    def test_model_formats_classes_and_inheritance(self):
        # The model is rendered with classes and an inheritance relation.
        model = Model(
            classes={
                "Child": Class(
                    "Child",
                    parent="Parent",
                    attributes={"created": Attribute("created", "Date", False)},
                ),
                "Parent": Class("Parent"),
            }
        )

        self.assertEqual(
            render_model(model),
            "@startuml\n"
            "class Child {\n"
            "  created : Date\n"
            "}\n"
            "class Parent {\n"
            "}\n"
            "Parent <|-- Child\n"
            "@enduml\n",
        )


if __name__ == "__main__":
    unittest.main()
