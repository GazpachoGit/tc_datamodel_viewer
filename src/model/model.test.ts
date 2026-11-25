import { describe, expect, it } from 'vitest';
import mappingYaml from '../../spec/mapping.yaml?raw';
import { buildModel } from './builder';
import { parseMapping } from './mapping';
import { parseTcXml } from './parser';
import { ModelError, type MappingConfig, type Model } from './types';

const mapping: MappingConfig = parseMapping(mappingYaml);

const NS = 'http://teamcenter.com/BusinessModel/TcBusinessData';

function build(...xmlFiles: string[]): Model {
  const files = xmlFiles.map((xml, i) => parseTcXml(`file${i}.xml`, xml));
  return buildModel(files, mapping);
}

// Example input from requirements.md.
const exampleXml = `
<TcBusinessData xmlns="${NS}">
  <TcClass className="Example">
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
</TcBusinessData>`;

describe('buildModel', () => {
  it('builds the Example class from requirements.md with mapped types', () => {
    const model = build(exampleXml);
    const example = model.classes.get('Example');
    expect(example).toBeDefined();
    expect(example!.parent).toBeUndefined();

    const types = Array.from(example!.attributes.values()).map((a) => [a.name, a.type]);
    expect(types).toEqual([
      ['names', 'String'],
      ['created', 'Date'],
      ['severity', 'Integer'],
      ['install_time', 'Integer'],
      ['cost', 'Double'],
      ['approved', 'Boolean'],
      ['description', 'LongString'],
      ['approver', 'TypedReference'],
      ['reference', 'UntypedReference'],
    ]);

    const names = example!.attributes.get('names')!;
    expect(names.isArray).toBe(true);
    expect(names.arrayFlagName).toBe('isArray');
    expect(names.arrayFlagValue).toBe('true');
    expect(names.chars).toEqual({ maxStringLength: '128' });

    const severity = example!.attributes.get('severity')!;
    expect(severity.isArray).toBe(false);
    expect(severity.chars).toEqual({ lowerBoundValue: '1', upperBoundValue: '10' });

    const approver = example!.attributes.get('approver')!;
    expect(approver.chars).toEqual({ typedRefClassName: 'GroupMember' });
  });

  it('omits missing and empty characteristics (AR1)', () => {
    const model = build(`
      <TcBusinessData xmlns="${NS}">
        <TcClass className="C">
          <TcAttribute attributeName="a" attributeType="POM_int"
                       isArray="false" lowerBoundValue="0" upperBoundValue=""/>
        </TcClass>
      </TcBusinessData>`);
    expect(model.classes.get('C')!.attributes.get('a')!.chars).toEqual({
      lowerBoundValue: '0',
    });
  });

  it('merges repeated class definitions and creates parents (NF3, NF4, NF5)', () => {
    const model = build(
      `<TcBusinessData xmlns="${NS}">
         <TcClass className="C" parentClassName="P">
           <TcAttribute attributeName="a" attributeType="POM_string" isArray="false"/>
         </TcClass>
       </TcBusinessData>`,
      `<TcBusinessData xmlns="${NS}">
         <TcClass className="C" parentClassName="P">
           <TcAttribute attributeName="b" attributeType="POM_string" isArray="false"/>
         </TcClass>
       </TcBusinessData>`,
    );
    expect(model.classes.size).toBe(2);
    const c = model.classes.get('C')!;
    expect(c.parent).toBe('P');
    expect(Array.from(c.attributes.keys())).toEqual(['a', 'b']);
    expect(model.classes.get('P')).toBeDefined();
    expect(model.classes.get('P')!.parent).toBeUndefined();
  });

  it('creates no relation for absent or empty parentClassName (NF5)', () => {
    const model = build(`
      <TcBusinessData xmlns="${NS}">
        <TcClass className="A"/>
        <TcClass className="B" parentClassName=""/>
      </TcBusinessData>`);
    expect(model.classes.get('A')!.parent).toBeUndefined();
    expect(model.classes.get('B')!.parent).toBeUndefined();
  });

  it('adds TcAttributeAttach attributes to existing or new classes (NF7)', () => {
    const model = build(`
      <TcBusinessData xmlns="${NS}">
        <TcClass className="C"/>
        <TcAttributeAttach className="C">
          <TcAttribute attributeName="x" attributeType="POM_string" isArray="true"/>
        </TcAttributeAttach>
        <TcAttributeAttach className="Other">
          <TcAttribute attributeName="y" attributeType="POM_date" isArray="false"/>
        </TcAttributeAttach>
      </TcBusinessData>`);
    expect(model.classes.get('C')!.attributes.get('x')!.isArray).toBe(true);
    expect(model.classes.get('Other')!.attributes.get('y')!.type).toBe('Date');
  });

  it('rejects duplicate attributes within a class (IV1)', () => {
    expect(() =>
      build(`
        <TcBusinessData xmlns="${NS}">
          <TcClass className="C">
            <TcAttribute attributeName="a" attributeType="POM_string" isArray="false"/>
          </TcClass>
          <TcAttributeAttach className="C">
            <TcAttribute attributeName="a" attributeType="POM_date" isArray="false"/>
          </TcAttributeAttach>
        </TcBusinessData>`),
    ).toThrowError(new ModelError('file0.xml: class "C" has a duplicate attribute "a" (IV1)'));
  });

  it('rejects two different non-empty parents (IV2)', () => {
    expect(() =>
      build(
        `<TcBusinessData xmlns="${NS}"><TcClass className="C" parentClassName="P1"/></TcBusinessData>`,
        `<TcBusinessData xmlns="${NS}"><TcClass className="C" parentClassName="P2"/></TcBusinessData>`,
      ),
    ).toThrowError(
      new ModelError('file1.xml: class "C" has conflicting parents "P1" and "P2" (IV2)'),
    );
  });

  it('lets a class without a parent receive one later (IV2)', () => {
    const model = build(
      `<TcBusinessData xmlns="${NS}"><TcClass className="C"/></TcBusinessData>`,
      `<TcBusinessData xmlns="${NS}"><TcClass className="C" parentClassName="P"/></TcBusinessData>`,
    );
    expect(model.classes.get('C')!.parent).toBe('P');
  });

  it('silently skips attributes with unknown types (IV3)', () => {
    const model = build(`
      <TcBusinessData xmlns="${NS}">
        <TcClass className="C">
          <TcAttribute attributeName="u" attributeType="POM_unknown" isArray="false"/>
          <TcAttribute attributeName="k" attributeType="POM_string" isArray="false"/>
        </TcClass>
      </TcBusinessData>`);
    expect(Array.from(model.classes.get('C')!.attributes.keys())).toEqual(['k']);
  });
});

describe('parseTcXml', () => {
  it('rejects malformed XML', () => {
    expect(() => parseTcXml('bad.xml', '<TcBusinessData>')).toThrowError(ModelError);
  });

  it('ignores elements outside the Teamcenter namespace', () => {
    const file = parseTcXml(
      'mixed.xml',
      `<root xmlns:tc="${NS}">
         <TcClass className="NotTc"/>
         <tc:TcClass className="InTc"/>
       </root>`,
    );
    expect(file.classes.map((c) => c.className)).toEqual(['InTc']);
  });
});
