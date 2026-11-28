import { describe, expect, it } from 'vitest';
import { isRelationClass, layoutModel } from '../layout/layout';
import { buildModel } from './builder';
import { parseDependencyXml, parseTcXml } from './parser';
import { selectArtifacts, visibleClassNames } from './selection';
import { ModelError, type ParsedFile } from './types';

const NS = 'http://teamcenter.com/BusinessModel/TcBusinessData';

function tc(template: string, body: string): ParsedFile {
  return parseTcXml(
    `${template}_template.xml`,
    `<TcBusinessData xmlns="${NS}"><Add>${body}</Add></TcBusinessData>`,
    template,
  );
}

// A dependency with a three-level hierarchy, relations, rules and LOVs.
const base = tc(
  'base',
  `
  <TcClass className="Root" parentClassName="NULL">
    <TcAttribute attributeName="root_attr" attributeType="POM_string" isArray="false"/>
  </TcClass>
  <TcClass className="ImanRelation" parentClassName="Root"/>
  <TcClass className="Middle" parentClassName="Root">
    <TcAttribute attributeName="mid_attr" attributeType="POM_int" isArray="false"/>
  </TcClass>
  <TcClass className="Leaf" parentClassName="Middle"/>
  <TcClass className="Unrelated" parentClassName="Root"/>
  <TcAttributeAttach className="Middle">
    <TcAttribute attributeName="attached" attributeType="POM_date" isArray="false"/>
  </TcAttributeAttach>
  <TcCompoundPropertyRule destTypeName="Middle" destPropertyName="mid_compound"
      pathToSource="REF(x).y"/>
  <TcCompoundPropertyRule destTypeName="Unrelated" destPropertyName="other_compound"/>
  <TcStandardType typeName="Middle">
    <TcProperty propName="BaseRelation" propTypeName="Relation"/>
  </TcStandardType>
  <TcLOVAttach lovName="MidLOV" typeName="Middle">
    <TcLOVAttachPropertyInfo valuePropertyName="mid_attr" conditionName="isTrue"/>
  </TcLOVAttach>
  <TcLOV name="MidLOV"><TcLOVValue value="1" description="one"/></TcLOV>
  <TcLOV name="MainLOV"><TcLOVValue value="base" description="from base"/></TcLOV>
  <TcLOV name="UnusedLOV"><TcLOVValue value="u"/></TcLOV>
  <TcGRMRule relationTypeName="SharedRel" primaryTypeName="Leaf" secondaryTypeName="Root"
      conditionName="isTrue"/>
  `,
);

const main = tc(
  'main',
  `
  <TcClass className="Child" parentClassName="Leaf">
    <TcAttribute attributeName="child_attr" attributeType="POM_string" isArray="false"/>
  </TcClass>
  <TcClass className="MainRelBase" parentClassName="ImanRelation"/>
  <TcClass className="MainRel" parentClassName="MainRelBase"/>
  <TcStandardType typeName="Child">
    <TcProperty propName="MainRel" propTypeName="Relation"/>
  </TcStandardType>
  <TcGRMRule relationTypeName="MainRel" primaryTypeName="Child" secondaryTypeName="Root"
      conditionName="isTrue"/>
  <TcLOVAttach lovName="MainLOV" typeName="Child">
    <TcLOVAttachPropertyInfo valuePropertyName="child_attr" conditionName="isTrue"/>
  </TcLOVAttach>
  <TcLOV name="MainLOV"><TcLOVValue value="main" description="from main"/></TcLOV>
  `,
);

function buildMain() {
  return buildModel(selectArtifacts(main, [base]));
}

describe('selectArtifacts (TL3)', () => {
  it('keeps the main template and follows parents up to the root', () => {
    const model = buildMain();
    expect(model.template).toBe('main');
    expect(model.classes.get('Child')?.ancestors).toEqual(['Leaf', 'Middle', 'Root']);
    // Ancestor classes come with their attributes, attaches and compounds.
    const middle = model.classes.get('Middle');
    expect(Array.from(middle?.attributes.keys() ?? [])).toEqual(['mid_attr', 'attached']);
    expect(Array.from(middle?.compounds.keys() ?? [])).toEqual(['mid_compound']);
    expect(model.classes.get('Root')?.attributes.has('root_attr')).toBe(true);
  });

  it('does not select unreferenced classes or dependency relation properties', () => {
    const model = buildMain();
    expect(model.classes.has('Unrelated')).toBe(false);
    expect(model.classes.has('BaseRelation')).toBe(false);
    expect(model.classes.get('Middle')?.relations.size).toBe(0);
    // A GRM rule of an unreferenced relation class is not selected.
    expect(model.classes.has('SharedRel')).toBe(false);
  });

  it('selects LOV definitions named by selected attachments only', () => {
    const [, filteredBase] = selectArtifacts(main, [base]);
    expect(filteredBase.lovDefinitions.map((d) => d.name).sort()).toEqual(['MainLOV', 'MidLOV']);
    const model = buildMain();
    expect(model.classes.get('Middle')?.attributes.get('mid_attr')?.lovs[0].values).toEqual([
      { value: '1', description: 'one' },
    ]);
  });

  it('gives TcLOV definitions of the main template precedence (TL4)', () => {
    const lov = buildMain().classes.get('Child')?.attributes.get('child_attr')?.lovs[0];
    expect(lov?.values).toEqual([{ value: 'main', description: 'from main' }]);
  });

  it('records the declaring template of each class', () => {
    const model = buildMain();
    expect(model.classes.get('Child')?.template).toBe('main');
    expect(model.classes.get('Leaf')?.template).toBe('base');
  });
});

describe('main template precedence (TL3a)', () => {
  const dep = tc(
    'dep',
    `
    <TcClass className="Shared" parentClassName="DepParent">
      <TcAttribute attributeName="size" attributeType="POM_int" isArray="false"/>
      <TcAttribute attributeName="dep_only" attributeType="POM_date" isArray="false"/>
    </TcClass>
    <TcCompoundPropertyRule destTypeName="Shared" destPropertyName="calc" pathToSource="dep"/>
    <TcLOVAttach lovName="SizeLOV" typeName="Shared">
      <TcLOVAttachPropertyInfo valuePropertyName="size" conditionName="isTrue"/>
    </TcLOVAttach>
    <TcGRMRule relationTypeName="SharedRel" primaryTypeName="A" secondaryTypeName="B"
        conditionName="isTrue" primaryCardinality="1"/>
    `,
  );
  const custom = tc(
    'custom',
    `
    <TcClass className="Shared" parentClassName="CustomParent">
      <TcAttribute attributeName="size" attributeType="POM_string" isArray="false"/>
    </TcClass>
    <TcCompoundPropertyRule destTypeName="Shared" destPropertyName="calc" pathToSource="custom"/>
    <TcLOVAttach lovName="SizeLOV" typeName="Shared">
      <TcLOVAttachPropertyInfo valuePropertyName="size" conditionName="isTrue"/>
    </TcLOVAttach>
    <TcGRMRule relationTypeName="SharedRel" primaryTypeName="A" secondaryTypeName="B"
        conditionName="isTrue" primaryCardinality="-1"/>
    `,
  );

  it('keeps the main definition when a dependency repeats it', () => {
    const model = buildModel(selectArtifacts(custom, [dep]));
    const shared = model.classes.get('Shared')!;
    // IV2: the main template's parent wins.
    expect(shared.parent).toBe('CustomParent');
    expect(model.classes.has('DepParent')).toBe(false);
    // IV1: the main template's attribute and compound property win; others are kept.
    expect(shared.attributes.get('size')?.type).toBe('String');
    expect(shared.attributes.has('dep_only')).toBe(true);
    expect(shared.compounds.get('calc')?.chars.pathToSource).toBe('custom');
    // IV7, IV6: one LOV attachment and one GRM rule, from the main template.
    expect(shared.attributes.get('size')?.lovs).toHaveLength(1);
    const rules = model.classes.get('SharedRel')!.grmRules;
    expect(rules.map((r) => r.chars.primaryCardinality)).toEqual(['-1']);
  });

  it('still rejects duplicates within one template', () => {
    const twice = tc(
      'twice',
      `<TcLOVAttach lovName="L" typeName="Shared">
         <TcLOVAttachPropertyInfo valuePropertyName="size" conditionName="isTrue"/>
         <TcLOVAttachPropertyInfo valuePropertyName="size" conditionName="isTrue"/>
       </TcLOVAttach>`,
    );
    expect(() => buildModel(selectArtifacts(twice, [dep]))).toThrowError(/\(IV7\)/);
  });
});

describe('visibleClassNames (UI12)', () => {
  it('shows main classes, their direct parents and relation classes only', () => {
    const visible = visibleClassNames(buildMain(), main);
    expect(Array.from(visible).sort()).toEqual([
      'Child',
      'ImanRelation',
      'Leaf',
      'MainRel',
      'MainRelBase',
    ]);
  });

  it('renders only visible classes and edges between them', async () => {
    const model = buildMain();
    const diagram = await layoutModel(model, {
      visible: visibleClassNames(model, main),
      templateLabel: (c) => (c.template !== 'main' ? c.template : undefined),
    });
    // UI6: ImanRelation stays hidden even though it is a direct parent.
    expect(diagram.nodes.map((n) => n.id).sort()).toEqual([
      'Child',
      'Leaf',
      'MainRel',
      'MainRelBase',
    ]);
    expect(diagram.edges.map((e) => e.id).sort()).toEqual([
      'Child-inherits-Leaf',
      'Child-relation-MainRel',
      'MainRel-inherits-MainRelBase',
    ]);
    expect(diagram.nodes.find((n) => n.id === 'Leaf')?.data.templateLabel).toBe('base');
    expect(diagram.nodes.find((n) => n.id === 'Child')?.data.templateLabel).toBeUndefined();
  });
});

describe('ancestors (NF12, UI7, IV8)', () => {
  it('recognizes relation classes through intermediate parents (UI7)', () => {
    const model = buildMain();
    expect(isRelationClass(model.classes.get('MainRel')!)).toBe(true);
    expect(isRelationClass(model.classes.get('MainRelBase')!)).toBe(true);
    expect(isRelationClass(model.classes.get('Child')!)).toBe(false);
  });

  it('treats parentClassName="NULL" as no parent (NF5)', () => {
    const model = buildMain();
    expect(model.classes.get('Root')?.parent).toBeUndefined();
    expect(model.classes.has('NULL')).toBe(false);
  });

  it('rejects inheritance cycles (IV8)', () => {
    const cyclic = tc(
      'cyclic',
      `<TcClass className="A" parentClassName="B"/>
       <TcClass className="B" parentClassName="A"/>`,
    );
    expect(() => buildModel([cyclic])).toThrowError(
      new ModelError('class "A" has an inheritance cycle (A -> B -> A) (IV8)'),
    );
  });
});

describe('parseDependencyXml (LT1, LT2)', () => {
  it('reads name, displayName and includes', () => {
    const info = parseDependencyXml(
      'issuemgmt_dependency.xml',
      `<?xml version="1.0"?>
       <!-- copyright -->
       <TcBusinessDataIncludes displayName="Issue Management" name="issuemgmt">
         <include file="foundation_template.xml"/>
         <include file="cm_template.xml"/>
       </TcBusinessDataIncludes>`,
    );
    expect(info).toEqual({
      name: 'issuemgmt',
      displayName: 'Issue Management',
      dependencyFile: 'issuemgmt_dependency.xml',
      templateFile: 'issuemgmt_template.xml',
      includes: ['foundation_template.xml', 'cm_template.xml'],
    });
  });

  it('falls back to name when displayName is missing', () => {
    const info = parseDependencyXml(
      'x_dependency.xml',
      '<TcBusinessDataIncludes name="x"/>',
    );
    expect(info.displayName).toBe('x');
    expect(info.includes).toEqual([]);
  });

  it('rejects a dependency file without name', () => {
    expect(() =>
      parseDependencyXml('x_dependency.xml', '<TcBusinessDataIncludes displayName="X"/>'),
    ).toThrowError(ModelError);
  });
});
