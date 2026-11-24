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

- **AC1.** The input XML conforms to the Teamcenter business model schema with namespace
   `http://teamcenter.com/BusinessModel/TcBusinessData`.
- **AC2.** The output is a PlantUML file.
- **AC3.** The utility is written in Python.
- **AC4.** Attribute mapping is defined in [mapping.yaml](./mapping.yaml).

## Input

- **IN1.** The utility accepts a path to a directory
   containing Teamcenter XML files.
- **IN2.** The utility processes XML files directly
   in that directory, without searching subdirectories.

## Output

- **OUT1.** The utility combines the XML files into
   one PlantUML file in the input directory.
- **OUT2.** The output file name includes a timestamp
   with second precision, for example model_20261124_102700.puml.
- **OUT3.** If the output file already exists, the
   utility overwrites it.

## Use case: Convert XML to PlantUML

### Normal flow

- **NF1.** Accept a directory of Teamcenter XML files
   as input.
- **NF2.** Iterate over its `TcClass` elements.
- **NF3.** Create a UML class for each `TcClass`, using its `className` as the class
   name. Use one UML class per `className`. If a class already exists,
   including one created as a parent, reuse it and add the attributes from
   the `TcClass` definition.
- **NF4.** For each `parentClassName`, create a UML class if one with that name does
   not already exist. Otherwise, reuse the existing class.
- **NF5.** Connect each class to its parent using a UML inheritance relation.
   If `parentClassName` is absent or empty, do not
   create an inheritance relation.
- **NF6.** For each `TcAttribute` inside a `TcClass`, create an attribute on the
   corresponding UML class. Apply the type and characteristic mappings from
   [mapping.yaml](./mapping.yaml);
- **NF7.** For each `TcAttributeAttach`, find the UML class named by its `className`,
   or create it if it does not exist. Add each nested `TcAttribute` to that
   class using the attribute mappings.
- **NF8.** Write the combined PlantUML output file
   to the input directory.

### Conflicting definitions

- **CD1.** The utility must stop and report an error when the
   same class is defined with different parent classes. The error must identify
   the class and both parent names. For example:

   ```xml
   <TcClass className="Car" parentClassName="Vehicle"/>
   <TcClass className="Car" parentClassName="Product"/>
   ```

- **CD2.** The utility must also stop and report an error when
   attributes of the same class have the same name but different types. The
   error must identify the class, the attribute, and both types. For example:

   ```xml
   <TcClass className="Car" parentClassName="Vehicle">
     <TcAttribute attributeName="speed" attributeType="POM_int"/>
     <TcAttribute attributeName="speed" attributeType="POM_string"/>
   </TcClass>
   ```

### Attribute representation

- **AR1.** Render each attribute as its name followed
   by the value of type in its mapping. The mapping's array_flag names the XML
   attribute that indicates an array; when its value is true, append [] to
   the type.
- **AR2.** The optional chars list names XML
   attributes to display as characteristics, using their original XML names
   and values in braces. Omit missing or empty characteristics. These
   characteristics are text in the diagram, not validation performed by
   PlantUML.

Examples:

```plantuml
class Example {
  names : String[] {maxStringLength=128}
  created : Date
  severity : Integer {lowerBoundValue=1, upperBoundValue=10}
  install_time : Integer {lowerBoundValue=0}
  cost : Double
  approved : Boolean
  description : LongString
  approver : TypedReference {typedRefClassName=GroupMember}
  reference : UntypedReference
}
```
