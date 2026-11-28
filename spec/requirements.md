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
- **Template**: a Teamcenter data model template, stored as a pair of files
  `<prefix>_template.xml` (the model) and `<prefix>_dependency.xml` (its
  name, display name and dependencies).
- **Main template**: the template selected by the user.
- **Dependency template**: a template listed in an `include` element of the
  main template's dependency file.

## Assumptions and constraints

- **AC1.** The input XML conforms to the Teamcenter business model schema with namespace
   `http://teamcenter.com/BusinessModel/TcBusinessData`.
- **AC2.** The conversion of Teamcenter XML into the intermediate model is
   defined in [mapping.md](./mapping.md).
- **AC3.** The viewer is a local service for a single user: a server on the
   user's machine reads the templates and builds the models, and a browser
   client displays them. The server listens on `127.0.0.1` by default and
   requires no authentication. XML data does not leave the machine.

## Input

- **IN1.** The template directory is set in the server configuration
   (`server.config.json`, field `modelDir`). Templates are not part of the
   project or the client build. Changes to the configuration or to the
   directory content take effect after the server is restarted. Selecting a
   directory in the UI is not required.
- **IN2.** The viewer processes only `*_dependency.xml` and `*_template.xml`
   files directly in that directory, without searching subdirectories (for
   example, `lang/` is ignored). A dependency file and a template file form
   one template when they share the same file name prefix.
- **IN3.** A `*_dependency.xml` file has a root `TcBusinessDataIncludes`
   element with `name` and `displayName` attributes and nested
   `include/@file` elements naming dependency template files. A template file
   without a dependency file is not listed.

## Input validation

- **IV1.** A duplicate property definition — the same name appearing more than
   once among the attributes (`attributeName`) and compound properties
   (`destPropertyName`) of the same class, across all `TcClass`,
   `TcAttributeAttach` and `TcCompoundPropertyRule` elements in all input
   files — is invalid input.
- **IV2.** Conflicting parents — two different non-empty `parentClassName`
   values for the same class — are invalid input. An absent, empty, or `NULL`
   `parentClassName` does not conflict with a non-empty one; a class created
   without a parent may receive one later.
- **IV3.** A `TcAttribute` whose `attributeType` is not defined in
   the attribute types table of [mapping.md](./mapping.md) is silently ignored: it is not added to the
   model and does not appear in the diagram or the properties panel.
- **IV4.** When invalid input (IV1, IV2, IV5, IV6, IV7, IV8) is detected, the
   viewer aborts building the model of the main template and displays an
   error message in the diagram area identifying the offending class and the
   duplicate property, conflicting parents, duplicate relation, duplicate GRM
   rule, duplicate LOV attach, or inheritance cycle. The templates panel stays
   available, so another template can be selected.
- **IV5.** A duplicate relation declaration — the same primary class and
   relation class pair declared more than once across all `TcStandardType`
   and `TcPropertyAttach` elements in all input files — is invalid input.
- **IV6.** A duplicate GRM rule — more than one `TcGRMRule` with the same
   composite identifier (`primaryTypeName`, `secondaryTypeName`,
   `conditionName`) for the same relation class, across all input files — is
   invalid input.
- **IV7.** A duplicate LOV attach — more than one LOV attachment with the
   same composite identifier (class attribute, `lovName`, `conditionName`),
   across all input files — is invalid input.
- **IV8.** An inheritance cycle — a class that appears among its own
   ancestors (NF12) — is invalid input.

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
<TcGRMRule xmlns="http://teamcenter.com/BusinessModel/TcBusinessData"
    relationTypeName="ExampleRelation" primaryTypeName="ExampleRevision"
    secondaryTypeName="GroupMember" conditionName="isTrue"
    primaryCardinality="-1" secondaryCardinality="1"/>
<TcLOVAttach xmlns="http://teamcenter.com/BusinessModel/TcBusinessData"
    lovName="ExampleLOV" typeName="Example">
  <TcLOVAttachPropertyInfo valuePropertyName="severity" conditionName="isTrue"
      override="false" level="0"/>
</TcLOVAttach>
<TcLOV xmlns="http://teamcenter.com/BusinessModel/TcBusinessData"
    name="ExampleLOV" lovType="ListOfValuesString" usage="Exhaustive">
  <TcLOVValue value="1" description="low" conditionName="isTrue"/>
  <TcLOVValue value="10" description="" conditionName="isTrue"/>
</TcLOV>
```

## User interface

- **UI1.** The UI contains three areas: a templates panel on the left, a
   UML-like class diagram in the center, and a properties panel on the right.
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
   item. A relation class node (UI7) can also be selected as a whole by
   clicking it; other classes cannot be selected.
- **UI5.** When an attribute is selected, the properties panel displays its
   characteristics as defined in [mapping.md](./mapping.md).
- **UI6.** The class named `ImanRelation` and all edges connected to it are
   not rendered in the diagram. The class remains part of the model.
- **UI7.** Relation class nodes — classes that have `ImanRelation` among
   their ancestors (NF12), directly or through intermediate classes such as
   `IssueRelation` — are rendered in a distinct color. The same rule defines
   the relation classes selectable in UI4 and shown by AR3.
- **UI8.** The properties panel contains two tabs: **Main** and **LOV**.
   Main is the default tab and displays the content defined by AR1–AR3. The
   LOV tab is shown only while the selected item is an attribute with a
   non-empty list of LOV attachments and displays the content defined by AR4.
- **UI9.** On startup the diagram is empty and shows a hint to select a
   template.
- **UI10.** The templates panel lists the `displayName` of every template
   (LT1), sorted alphabetically. The template `name` is used as its internal
   identifier. The selected template is highlighted.
- **UI11.** Clicking a template starts the use case "Load a template". While
   it runs, the diagram area shows a loading indicator, and clicks on
   templates are ignored. When it finishes, the diagram of the template is
   shown.
- **UI12.** The diagram of a template shows only the following classes of its
   model:
   - classes declared by a `TcClass` of the main template or extended by the
     main template (`TcAttributeAttach`, `TcCompoundPropertyRule`,
     `TcLOVAttach`, relation properties of NF9);
   - the direct parents of these classes;
   - the relation classes of the main template's relation properties (NF9).

   Other classes of the model, such as more distant ancestors, are not
   rendered. Edges are rendered only between rendered classes. A rendered
   class declared in a dependency template shows that template's
   `displayName` in its node.

### Properties Panel

#### Attribute representation

- **AR1.** When an attribute is selected, the properties panel lists its name,
   mapped type, array flag, and characteristics (see the Attribute section of
   [mapping.md](./mapping.md)). Display each item on a separate line in the
   format `<property name> : <value>`. Use `attributeName` for the attribute
   name, `type` for its mapped type, `isArray` for the array flag, and the
   original XML names for characteristics. Omit missing or empty
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
   the original XML names for characteristics (see the Compound section of
   [mapping.md](./mapping.md)). There is no
   array flag line. Omit missing or empty characteristics.

Properties panel for the selected `approver_group` compound property:

```text
destPropertyName : approver_group
type : Compound
pathToSource : REF(approver,GroupMember).group
```

#### Relation class representation

- **AR3.** When a relation class is selected, the properties panel lists the
   class name and its GRM rules. Display `className` with the class name on
   the first line, then one block per GRM rule starting with a `GRMRule:`
   heading followed by the rule's characteristics as defined in the GRMRule
   section of [mapping.md](./mapping.md), one `<property name> : <value>` line each, using the
   original XML names. Omit missing or empty characteristics. Rules keep
   their input order.

Properties panel for the selected `ExampleRelation` relation class:

```text
className : ExampleRelation

GRMRule:
primaryTypeName : ExampleRevision
secondaryTypeName : GroupMember
conditionName : isTrue
primaryCardinality : -1
secondaryCardinality : 1
```

#### LOV representation

- **AR4.** The LOV tab lists the LOV attachments of the selected attribute,
   one block per attachment. Each block displays `lovName` and
   `conditionName` as `<property name> : <value>` lines, followed by a
   `values:` line and one line per value in the format
   `<value> : <description>`; an empty description is displayed as `NA`.
   Values keep their input order. When the LOV definition was not found
   (NF11), the block displays a `LOV "<lovName>" not found` message instead
   of the values.

LOV tab for the selected `severity` attribute:

```text
lovName : ExampleLOV
conditionName : isTrue
values:
1 : low
10 : NA
```

LOV tab block for an attachment whose `TcLOV` definition is missing:

```text
lovName : MissingLOV
conditionName : isTrue
LOV "MissingLOV" not found
```

## Use case: Load the template list

- **LT1.** On server startup, read every `*_dependency.xml` file (IN2, IN3)
   and extract the template `name`, `displayName`, and the list of `include`
   files. On client startup, request the list from the server.
- **LT2.** A dependency file that is not well-formed, or lacks `name`, is an
   application error. An unreachable server is an application error as
   well. Both are displayed instead of the UI.

## Use case: Load a template

Steps TL1–TL5 run on the server; the client receives the built model
(TL6).

- **TL1.** Load the `_template.xml` file of the main template and the
   template files listed in its `include` elements. Only one level is
   loaded: the `include` elements of dependency templates are not followed.
   A listed file that does not exist is an error naming the file.
- **TL2.** Parse each file independently. The parse result of a file is
   cached by file name and reused by other templates, so a shared dependency
   such as `foundation_template.xml` is parsed once while the server runs.
- **TL3.** Select the artifacts to build from:
   - all artifacts of the main template;
   - every class referenced by the main template through `parentClassName`,
     `TcAttributeAttach/@className`, `TcCompoundPropertyRule/@destTypeName`,
     the `typeName` and `propName` of relation properties (NF9),
     `TcGRMRule/@relationTypeName`, or `TcLOVAttach/@typeName`;
   - for each referenced class, its `TcClass` with attributes, and its
     `TcAttributeAttach`, `TcCompoundPropertyRule`, `TcGRMRule` (by
     `relationTypeName`), and `TcLOVAttach` elements from the dependency
     templates; the parent of a selected class is selected the same way,
     up to the root of the hierarchy;
   - the `TcLOV` definitions named by the `lovName` of selected LOV
     attachments.

   Relation properties (NF9) of dependency templates are not selected.
   `typedRefClassName`, `primaryTypeName`, and `secondaryTypeName` stay
   characteristics and do not select classes.
- **TL4.** Build the intermediate model from the selected artifacts by NF1–NF12,
   processing the main template first and then the dependency templates in
   `include` order; therefore, for NF11, a `TcLOV` of the main template takes
   precedence.
- **TL5.** Cache the built model of the template by its `name`. Selecting the
   template again shows the cached model without parsing or building.
- **TL6.** The client receives the model and the visible classes (UI12),
   lays them out, and displays them.

## Use case: Build the intermediate model

### Normal flow

- **NF1.** Process the artifacts selected by TL3.
- **NF2.** Iterate over its `TcClass` elements.
- **NF3.** Create a UML class for each `TcClass`, using its `className` as the class
   name. Use one UML class per `className`, reusing an existing class and
   adding attributes from each `TcClass` definition. Adding an attribute whose
   name already exists on the class is invalid input (IV1).
- **NF4.** For each `parentClassName`, create a UML class if one with that
   name does not already exist. Otherwise, reuse the existing class.
- **NF5.** Connect each class to its parent using a UML inheritance relation.
   If `parentClassName` is absent, empty, or `NULL`, do not
   create an inheritance relation. If the class already has a different
   non-empty parent, the input is invalid (IV2).
- **NF6.** For each `TcAttribute` inside a `TcClass`, create an attribute on the
   corresponding UML class. Convert its type and characteristics as defined
   in [mapping.md](./mapping.md); if the `attributeType` is not listed there,
   skip the attribute (IV3).
- **NF7.** For each `TcAttributeAttach`, find the UML class named by its `className`,
   or create it if it does not exist. Add each nested `TcAttribute` to that
   class the same way as in NF6. IV1 and IV3 apply to these attributes
   as well.
- **NF8.** For each `TcCompoundPropertyRule`, find the UML class named by its
   `destTypeName`, or create it if it does not exist. Add a compound property
   named by `destPropertyName` to that class, with the type and
   characteristics defined in the Compound section of
   [mapping.md](./mapping.md). Other XML attributes of the rule are not
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
- **NF10.** For each `TcGRMRule`, find the UML class named by its
   `relationTypeName`, or create it if it does not exist. Append a GRM rule to that class with the characteristics
   defined in the GRMRule section of [mapping.md](./mapping.md): the original
   XML attribute values. Rules keep their
   input order; other XML attributes of the rule are not displayed. A
   repeated composite identifier is invalid input (IV6). After all input
   files are processed, a class that has GRM rules, is not declared by any
   `TcClass`, and has no parent gets `ImanRelation` as its parent; a
   `TcClass` declaring another parent therefore does not conflict (IV2).
- **NF11.** After NF1–NF10 have been applied to all input files, process the
   LOV attachments. For each `TcLOVAttach` and each of its nested
   `TcLOVAttachPropertyInfo` elements, find the UML class named by the
   `TcLOVAttach`'s `typeName` and that class's own attribute named by the
   info's `valuePropertyName`; if the class or the attribute is not found,
   silently skip the attachment. Add an LOV record with the `lovName` and
   `conditionName` to the attribute; a repeated composite identifier is
   invalid input (IV7). Find the first `TcLOV` whose `name` equals `lovName`,
   in file load order, and add its nested `TcLOVValue` elements (`value`,
   `description`) to the record in input order. When no such `TcLOV` exists,
   the record keeps no values and is marked as not found (AR4).
- **NF12.** After NF1–NF11, compute the ancestors of every class: the names
   of its parent, the parent's parent, and so on up to a class without a
   parent, nearest first. A class that appears among its own ancestors is
   invalid input (IV8).
