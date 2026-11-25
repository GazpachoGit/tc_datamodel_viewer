# Requirements

## Product overview

The product is a viewer for class diagrams generated from Teamcenter data model
XML. It presents classes, inheritance relationships, and attributes in a
UML-like diagram, and displays additional Teamcenter-specific information about
selected attributes in a properties panel.

## Glossary

- **TC**: Teamcenter.
- **Artifact**: an object in a given context, such as a UML class, attribute,
  or relation.

## Assumptions and constraints

- **AC1.** The input XML conforms to the Teamcenter business model schema with namespace
   `http://teamcenter.com/BusinessModel/TcBusinessData`.
- **AC2.** Attribute mapping is defined in [mapping.yaml](./mapping.yaml).

## Input

- **IN1.** Teamcenter XML files are included in the application source under
   `src/data/xml` and bundled with the viewer.
- **IN2.** The viewer processes XML files directly in that directory, without
   searching subdirectories. Selecting a directory at runtime is not required.
- **IN3.** The attribute mapping file is included in the viewer's source files
   and is not supplied as runtime input.

## Input validation

- **IV1.** A duplicate property definition — the same name appearing more than
   once among the attributes (`attributeName`) and compound properties
   (`destPropertyName`) of the same class, across all `TcClass`,
   `TcAttributeAttach` and `TcCompoundPropertyRule` elements in all input
   files — is invalid input.
- **IV2.** Conflicting parents — two different non-empty `parentClassName`
   values for the same class — are invalid input. An absent or empty
   `parentClassName` does not conflict with a non-empty one; a class created
   without a parent may receive one later.
- **IV3.** A `TcAttribute` whose `attributeType` is not defined in
   [mapping.yaml](./mapping.yaml) is silently ignored: it is not added to the
   model and does not appear in the diagram or the properties panel.
- **IV4.** When invalid input (IV1, IV2, IV5) is detected, the viewer aborts
   building the model and displays only an error message identifying the
   offending class and the duplicate property, conflicting parents, or
   duplicate relation.
- **IV5.** A duplicate relation declaration — the same primary class and
   relation class pair declared more than once across all `TcStandardType`
   and `TcPropertyAttach` elements in all input files — is invalid input.

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
<TcCompoundPropertyRule xmlns="http://teamcenter.com/BusinessModel/TcBusinessData"
    destTypeName="Example" destPropertyName="approver_group"
    sourceTypeName="GroupMember" sourcePropertyName="group" isReadOnly="true"
    pathToSource="REF(approver,GroupMember).group"/>
<TcStandardType xmlns="http://teamcenter.com/BusinessModel/TcBusinessData"
    typeName="ExampleRevision" parentTypeName="ItemRevision">
  <TcProperty propName="ExampleRelation" propTypeName="Relation"
              propValueType="PROP_untyped_relation" isArray="true"/>
</TcStandardType>
<TcPropertyAttach xmlns="http://teamcenter.com/BusinessModel/TcBusinessData"
    typeName="WorkspaceObject">
  <TcProperty propName="ExampleRelation" propTypeName="Relation"
              propValueType="PROP_untyped_relation" isArray="true"/>
</TcPropertyAttach>
```

## User interface

- **UI1.** The UI contains two areas: a UML-like class diagram and a properties
   panel.
- **UI2.** The diagram connects parent and child classes with inheritance
   relations. Relation connections (NF9) are rendered as dashed edges with an
   arrow pointing from the primary class to the relation class, visually
   distinct from inheritance relations.
- **UI3.** Each class node is rendered in a style similar to UML class
   notation. It contains the class name and a list of attributes showing each
   attribute's name, mapped type, and array marker when applicable.
   Compound properties are rendered after the attributes as `name : Compound`
   rows without an array marker.
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
     approver_group : Compound
   }
   ```
- **UI4.** The user can select an attribute or a compound property in the
   diagram. The properties panel displays the properties of the selected
   item. Classes cannot be selected.
- **UI5.** When an attribute is selected, the properties panel displays its
   characteristics as defined by the attribute mapping.

### Properties Panel

#### Attribute representation

- **AR1.** When an attribute is selected, the properties panel lists its name,
   mapped type, array flag, and mapped characteristics. Display each item on a
   separate line in the format `<property name> : <value>`. Use
   `attributeName` for the attribute name, `type` for its mapped type, the
   mapped `array_flag` XML attribute for the array flag, and the original XML
   names for characteristics listed in `chars`. Omit missing or empty
   characteristics.

Properties panel for the selected `names` attribute:

```text
attributeName : names
type : String
isArray : true
maxStringLength : 128
```

Properties panel for the selected `severity` integer attribute:

```text
attributeName : severity
type : Integer
isArray : false
lowerBoundValue : 1
upperBoundValue : 10
```

Properties panel for the selected `approver` typed reference attribute:

```text
attributeName : approver
type : TypedReference
isArray : false
typedRefClassName : GroupMember
```

#### Compound property representation

- **AR2.** When a compound property is selected, the properties panel lists
   its name, mapped type, and mapped characteristics. Display each item on a
   separate line in the format `<property name> : <value>`. Use
   `destPropertyName` for the property name, `type` for its mapped type, and
   the original XML names for characteristics listed in `chars`. There is no
   array flag line. Omit missing or empty characteristics.

Properties panel for the selected `approver_group` compound property:

```text
destPropertyName : approver_group
type : Compound
pathToSource : REF(approver,GroupMember).group
```

## Use case: Build the intermediate model

### Normal flow

- **NF1.** Load the Teamcenter XML files bundled from `src/data/xml`.
- **NF2.** Iterate over its `TcClass` elements.
- **NF3.** Create a UML class for each `TcClass`, using its `className` as the class
   name. Use one UML class per `className`, reusing an existing class and
   adding attributes from each `TcClass` definition. Adding an attribute whose
   name already exists on the class is invalid input (IV1).
- **NF4.** For each `parentClassName`, create a UML class if one with that
   name does not already exist. Otherwise, reuse the existing class.
- **NF5.** Connect each class to its parent using a UML inheritance relation.
   If `parentClassName` is absent or empty, do not
   create an inheritance relation. If the class already has a different
   non-empty parent, the input is invalid (IV2).
- **NF6.** For each `TcAttribute` inside a `TcClass`, create an attribute on the
   corresponding UML class. Apply the type and characteristic mappings from
   [mapping.yaml](./mapping.yaml); if the `attributeType` is not defined in the
   mapping, skip the attribute (IV3).
- **NF7.** For each `TcAttributeAttach`, find the UML class named by its `className`,
   or create it if it does not exist. Add each nested `TcAttribute` to that
   class using the attribute mappings. IV1 and IV3 apply to these attributes
   as well.
- **NF8.** For each `TcCompoundPropertyRule`, find the UML class named by its
   `destTypeName`, or create it if it does not exist. Add a compound property
   named by `destPropertyName` to that class, applying the
   `TcCompoundPropertyRule` mapping from [mapping.yaml](./mapping.yaml) for
   its type and characteristics. Other XML attributes of the rule are not
   displayed. IV1 applies to compound properties as well.
- **NF9.** For each `TcProperty` with `propTypeName="Relation"` nested in a
   `TcStandardType` or `TcPropertyAttach` element, the property's `propName`
   is the name of a relation class. Find that UML class, or create it if it
   does not exist. Find the UML class named by the enclosing element's
   `typeName` (the primary class), or create it if it does not exist. Add the
   relation class name to the primary class's relations; a repeated
   declaration of the same pair is invalid input (IV5). `TcProperty` elements
   in other contexts and their other XML attributes are ignored; relation
   properties are not rendered as rows in the primary class node.
