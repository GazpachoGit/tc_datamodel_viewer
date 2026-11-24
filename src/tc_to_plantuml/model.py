from dataclasses import dataclass, field


@dataclass
class Attribute:
    name: str
    type: str
    is_array: bool
    chars: dict[str, str] = field(default_factory=dict)


@dataclass
class Class:
    name: str
    parent: str | None = None
    attributes: dict[str, Attribute] = field(default_factory=dict)


@dataclass
class Model:
    classes: dict[str, Class] = field(default_factory=dict)

    def get_class(self, name: str) -> Class:
        if name not in self.classes:
            self.classes[name] = Class(name)
        return self.classes[name]
