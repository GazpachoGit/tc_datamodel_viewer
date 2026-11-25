# Requirements

## Product overview

The product is a viewer for class diagrams generated from Teamcenter data model
XML. It presents classes, inheritance relationships, and attributes in a
UML-like diagram, and displays additional Teamcenter-specific information about
selected classes and attributes in a properties panel.

## Glossary

- **TC**: Teamcenter.
- **Artifact**: an object in a given context, such as a UML class, attribute,
  or relation.

## Assumptions and constraints

- **AC1.** The input XML conforms to the Teamcenter business model schema with namespace
   `http://teamcenter.com/BusinessModel/TcBusinessData`.
- **AC2.** The viewer is written in Python.
- **AC3.** Attribute mapping is defined in [mapping.yaml](./mapping.yaml).

## Input

- **IN1.** The viewer provides a setting for the path to the directory
   containing Teamcenter XML files.
- **IN2.** The utility processes XML files directly
   in that directory, without searching subdirectories.
- **IN3.** The attribute mapping file is included in the viewer's source files
   and is not supplied as runtime input.

## Example input

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

## User interface

- **UI1.** The UI contains two areas: a UML-like class diagram and a properties
   panel.
- **UI2.** The diagram connects parent and child classes with inheritance
   relations.
- **UI3.** Each class node is rendered in a style similar to UML class
   notation. It contains the class name and a list of attributes showing each
   attribute's name, mapped type, and array marker when applicable.
   Attribute characteristics are not shown in the class node; they are shown
   in the properties panel.

   Example diagram representation:

   ```text
   class Example {
     names : String[]
     created : Date
     severity : Integer
     install_time : Integer
     cost : Double
     approved : Boolean
     description : LongString
     approver : TypedReference
     reference : UntypedReference
   }
   ```
- **UI4.** The user can select a class or an attribute in the diagram. The
   properties panel displays the properties of the selected element.
- **UI5.** When an attribute is selected, the properties panel displays its
   characteristics as defined by the attribute mapping.

### Properties Panel

#### Attribute representation

- **AR1.** When an attribute is selected, the properties panel lists its name,
   array flag, and mapped characteristics. Display each item on a separate
   line in the format `<XML attribute name> : <value>`. Use `attributeName`
   for the attribute name, the mapped `array_flag` XML attribute for the array
   flag, and the original XML names for characteristics listed in `chars`.
   Omit missing or empty characteristics.

Properties panel for the selected `names` attribute:

```text
attributeName : names
isArray : true
maxStringLength : 128
```

Properties panel for the selected `severity` integer attribute:

```text
attributeName : severity
isArray : false
lowerBoundValue : 1
upperBoundValue : 10
```

Properties panel for the selected `approver` typed reference attribute:

```text
attributeName : approver
isArray : false
typedRefClassName : GroupMember
```

## Use case: Build the intermediate model

### Normal flow

- **NF1.** Accept a directory of Teamcenter XML files
   as input.
- **NF2.** Iterate over its `TcClass` elements.
- **NF3.** Create a UML class for each `TcClass`, using its `className` as the class
   name. Use one UML class per `className`, reusing an existing class and
   adding attributes from each `TcClass` definition.
- **NF4.** For each `parentClassName`, create a UML class if one with that
   name does not already exist. Otherwise, reuse the existing class.
- **NF5.** Connect each class to its parent using a UML inheritance relation.
   If `parentClassName` is absent or empty, do not
   create an inheritance relation.
- **NF6.** For each `TcAttribute` inside a `TcClass`, create an attribute on the
   corresponding UML class. Apply the type and characteristic mappings from
   [mapping.yaml](./mapping.yaml);
- **NF7.** For each `TcAttributeAttach`, find the UML class named by its `className`,
   or create it if it does not exist. Add each nested `TcAttribute` to that
   class using the attribute mappings.
