from dataclasses import dataclass
from pathlib import Path
import sysconfig
from xml.etree import ElementTree

import yaml

from .model import Attribute, Class, Model


NAMESPACE = "http://teamcenter.com/BusinessModel/TcBusinessData"
CLASS_TAG = f"{{{NAMESPACE}}}TcClass"
ATTACH_TAG = f"{{{NAMESPACE}}}TcAttributeAttach"
ATTRIBUTE_TAG = f"{{{NAMESPACE}}}TcAttribute"


@dataclass(frozen=True)
class TypeMapping:
    type: str
    array_flag: str
    chars: tuple[str, ...]


def mapping_path() -> Path:
    source_mapping = Path(__file__).resolve().parents[2] / "spec" / "mapping.yaml"
    if source_mapping.is_file():
        return source_mapping
    data_path = sysconfig.get_path("data")
    if data_path is None:
        raise ValueError("Cannot determine the installation data directory")
    return Path(data_path) / "share" / "tc-to-plantuml" / "mapping.yaml"


def load_mapping(path: Path) -> dict[str, TypeMapping]:
    with path.open(encoding="utf-8") as file:
        document = yaml.safe_load(file)
    if not isinstance(document, dict):
        raise ValueError(f"{path}: mapping must be a YAML object")
    attributes = document.get("TcAttribute")
    if not isinstance(attributes, dict) or not isinstance(attributes.get("types"), dict):
        raise ValueError(f"{path}: TcAttribute.types must be a YAML object")

    result: dict[str, TypeMapping] = {}
    for source_type, rule in attributes["types"].items():
        if not isinstance(source_type, str) or not isinstance(rule, dict):
            raise ValueError(f"{path}: invalid type mapping {source_type!r}")
        mapped_type = rule.get("type")
        array_flag = rule.get("array_flag")
        chars = rule.get("chars", [])
        if (
            not isinstance(mapped_type, str)
            or not mapped_type.isidentifier()
            or not isinstance(array_flag, str)
            or not array_flag
            or not isinstance(chars, list)
            or not all(isinstance(char, str) and char.isidentifier() for char in chars)
        ):
            raise ValueError(f"{path}: invalid mapping for {source_type}")
        result[source_type] = TypeMapping(mapped_type, array_flag, tuple(chars))
    return result


def _required(element: ElementTree.Element, name: str, path: Path) -> str:
    value = element.get(name)
    if value is None or not value.strip():
        raise ValueError(f"{path}: {element.tag} is missing {name}")
    return value


def _identifier(value: str, context: str) -> str:
    if not value.isidentifier():
        raise ValueError(f"{context}: unsupported identifier {value!r}")
    return value


def _add_attributes(
    target: Class,
    element: ElementTree.Element,
    mappings: dict[str, TypeMapping],
    path: Path,
) -> None:
    for node in element.findall(ATTRIBUTE_TAG):
        name = _identifier(_required(node, "attributeName", path), str(path))
        if name in target.attributes:
            raise ValueError(f"{path}: duplicate attribute {target.name}.{name}")
        source_type = _required(node, "attributeType", path)
        mapping = mappings.get(source_type)
        if mapping is None:
            raise ValueError(f"{path}: unknown attribute type {source_type!r} for {target.name}.{name}")
        flag = _required(node, mapping.array_flag, path).lower()
        if flag not in ("true", "false"):
            raise ValueError(f"{path}: invalid {mapping.array_flag} value {flag!r} for {target.name}.{name}")
        chars = {
            char: value
            for char in mapping.chars
            if (value := node.get(char)) is not None and value != ""
        }
        for char, value in chars.items():
            if any(character in value for character in "\r\n{}<>"):
                raise ValueError(f"{path}: unsupported {char} value {value!r} for {target.name}.{name}")
        target.attributes[name] = Attribute(name, mapping.type, flag == "true", chars)


def read_model(paths: list[Path], mappings: dict[str, TypeMapping]) -> Model:
    model = Model()
    for path in paths:
        root = ElementTree.parse(path).getroot()
        if root.tag != f"{{{NAMESPACE}}}TcBusinessData":
            raise ValueError(f"{path}: expected TcBusinessData in the Teamcenter namespace")
        for node in root.iter():
            if node.tag not in (CLASS_TAG, ATTACH_TAG):
                continue
            name = _identifier(_required(node, "className", path), str(path))
            target = model.get_class(name)
            if node.tag == CLASS_TAG:
                parent = node.get("parentClassName")
                if parent:
                    parent = _identifier(parent, str(path))
                    if target.parent is not None and target.parent != parent:
                        raise ValueError(
                            f"{path}: class {name} has conflicting parents "
                            f"{target.parent!r} and {parent!r}"
                        )
                    target.parent = parent
                    model.get_class(parent)
            _add_attributes(target, node, mappings, path)
    return model
