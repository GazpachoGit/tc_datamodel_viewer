from .model import Attribute, Class, Model


def render_attribute(attribute: Attribute) -> str:
    array = "[]" if attribute.is_array else ""
    chars = ""
    if attribute.chars:
        values = ", ".join(f"{key}={value}" for key, value in attribute.chars.items())
        chars = f" {{{values}}}"
    return f"  {attribute.name} : {attribute.type}{array}{chars}"


def render_class(uml_class: Class) -> list[str]:
    lines = [f"class {uml_class.name} {{"]
    lines.extend(render_attribute(attribute) for attribute in uml_class.attributes.values())
    lines.append("}")
    return lines


def render_model(model: Model) -> str:
    lines = ["@startuml"]
    for uml_class in model.classes.values():
        lines.extend(render_class(uml_class))
    for uml_class in model.classes.values():
        if uml_class.parent is not None:
            lines.append(f"{uml_class.parent} <|-- {uml_class.name}")
    lines.append("@enduml")
    return "\n".join(lines) + "\n"
