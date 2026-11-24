# Requirements

## Product overview

The utility converts a Teamcenter template XML file representing a data model
into a PlantUML class diagram. The diagram provides a readable representation
of the Teamcenter data model.

## Glossary

- **TC**: Teamcenter.
- **Artifact**: an object in a given context, such as a UML class, attribute,
  or relation.

## Assumptions and constraints

1. The input XML conforms to the Teamcenter business model schema with namespace
   `http://teamcenter.com/BusinessModel/TcBusinessData`.
2. The output is a PlantUML file.
3. The utility is written in Python.
4. Attribute mapping is defined in [mapping.yaml](./mapping.yaml).

## Use case: Convert XML to PlantUML

### Normal flow

1. Accept a Teamcenter XML file as input.
2. Iterate over its `TcClass` elements.
3. Create a UML class for each `TcClass`, using its `className` as the class
   name.
4. For each `parentClassName`, create a UML class if one with that name does
   not already exist. Otherwise, reuse the existing class.
5. Connect each class to its parent using a UML inheritance relation.
6. For each `TcAttribute` inside a `TcClass`, create an attribute on the
   corresponding UML class. Apply the type and characteristic mappings from
   [mapping.yaml](./mapping.yaml);
7. Write the PlantUML output file to the current working directory from which
   the utility was invoked.
