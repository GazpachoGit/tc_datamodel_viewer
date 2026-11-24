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
   name. Use one UML class per `className`, reusing an existing class and
   adding attributes from each `TcClass` definition.
- **NF4.** For the `parentClassName` of the first `TcClass` definition,
   create a UML class if one with that name does not already exist. Otherwise,
   reuse the existing class.
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

### Exception path

- **EP1.** If a `TcClass` with the same `className` was already defined,
   add its attributes to the existing class without reporting a duplicate
   class error. Keep the parent from the first processed `TcClass` definition,
   even if it has no parent. Duplicate attributes are handled according to
   EP2. For example, `Car` retains `Vehicle` as its parent:

   ```xml
   <TcClass className="Car" parentClassName="Vehicle"/>
   <TcClass className="Car" parentClassName="Product"/>
   ```

- **EP2.** If an attribute with the same name already exists in the same
   class, report an error identifying the class and attribute in the console,
   skip the repeated attribute, and continue processing. This applies to
   attributes from both `TcClass` and `TcAttributeAttach`. For example:

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

Example XML fragment:

```xml
<TcClass xmlns="http://teamcenter.com/BusinessModel/TcBusinessData"
         className="Example">
  <TcAttribute attributeName="names" attributeType="POM_string"
               isArray="true" maxStringLength="128"/>
  <TcAttribute attributeName="created" attributeType="POM_date"
               isArray="false"/>
  <TcAttribute attributeName="severity" attributeType="POM_int"
               isArray="false" lowerBoundValue="1" upperBoundValue="10"/>
  <TcAttribute attributeName="install_time" attributeType="POM_int"
               isArray="false" lowerBoundValue="0"/>
  <TcAttribute attributeName="cost" attributeType="POM_double"
               isArray="false"/>
  <TcAttribute attributeName="approved" attributeType="POM_logical"
               isArray="false"/>
  <TcAttribute attributeName="description" attributeType="POM_long_string"
               isArray="false"/>
  <TcAttribute attributeName="approver" attributeType="POM_typed_reference"
               isArray="false" typedRefClassName="GroupMember"/>
  <TcAttribute attributeName="reference" attributeType="POM_untyped_reference"
               isArray="false"/>
</TcClass>
```

Corresponding PlantUML:

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
