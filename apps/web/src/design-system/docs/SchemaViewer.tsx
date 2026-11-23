import { createContext, useContext, useEffect, useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from '../cx';
import { useDsMessages } from '../i18n';

/** The subset of JSON Schema / OpenAPI schema objects the viewer understands. */
export interface Schema {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: Array<string | number | boolean | null>;
  default?: unknown;
  example?: unknown;
  nullable?: boolean;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  /** Composition: every schema at once (merged), exactly one of them, or one or more of them. */
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  /** Which property tells the oneOf/anyOf variants apart, and its value for each one. */
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
  /** Set by the spec loader where a $ref points back to a schema already being expanded (a cycle): the schema's name. */
  'x-circular'?: string;
}

/** allOf merged into one schema: properties and required lists combined, other keys from the first that has them. */
export function mergeSchema(schema: Schema): Schema {
  if (!schema.allOf) return schema;
  const { allOf, ...rest } = schema;
  return allOf.map(mergeSchema).reduce<Schema>((merged, part) => ({
    ...part,
    ...merged,
    type: merged.type ?? part.type,
    // Earlier parts first (allOf: [Base, Extra] lists Base's fields, then Extra's).
    properties: { ...merged.properties, ...part.properties },
    required: [...new Set([...(merged.required ?? []), ...(part.required ?? [])])],
  }), { ...rest, properties: { ...rest.properties }, required: rest.required ?? [] });
}

const variantsOf = (schema: Schema) => schema.oneOf ?? schema.anyOf;

function typeLabel(input: Schema): string {
  if (input['x-circular']) return input['x-circular'];
  const schema = mergeSchema(input);
  const variants = variantsOf(schema);
  if (variants) return variants.map((variant) => variant.title ?? typeLabel(variant)).join(' | ');
  // A named object (a $ref to a model) reads better by its name than as "object".
  if (schema.title && (schema.type === 'object' || (!schema.type && schema.properties))) return schema.nullable ? `${schema.title} | null` : schema.title;
  const base = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type ?? (schema.properties ? 'object' : 'any');
  let label = base === 'array' ? `array<${schema.items ? typeLabel(schema.items) : 'any'}>` : base;
  if (schema.format) label += ` (${schema.format})`;
  if (schema.nullable) label += ' | null';
  return label;
}

/** What a schema expands into: an object's fields, the fields of an array's items, or oneOf/anyOf variants. */
function expandable(input: Schema): { kind: 'fields' | 'variants'; schema: Schema } | undefined {
  if (input['x-circular']) return undefined;
  const schema = mergeSchema(input);
  if (variantsOf(schema)) return { kind: 'variants', schema };
  if (schema.properties && Object.keys(schema.properties).length) return { kind: 'fields', schema };
  if (!schema.items || schema.items['x-circular']) return undefined;
  const items = mergeSchema(schema.items);
  if (variantsOf(items)) return { kind: 'variants', schema: items };
  if (items.properties && Object.keys(items.properties).length) return { kind: 'fields', schema: items };
  return undefined;
}

/** Name of the schema a property points back to, for $ref cycles (itself or its array items). */
const circularName = (schema: Schema) => schema['x-circular'] ?? schema.items?.['x-circular'];

const format = (value: unknown) => (typeof value === 'string' ? `"${value}"` : JSON.stringify(value));

function Constraints({ schema }: { schema: Schema }) {
  const t = useDsMessages();
  const rules: string[] = [];
  if (schema.minimum !== undefined) rules.push(t.minimum(schema.minimum));
  if (schema.maximum !== undefined) rules.push(t.maximum(schema.maximum));
  if (schema.minLength !== undefined) rules.push(t.minLength(schema.minLength));
  if (schema.maxLength !== undefined) rules.push(t.maxLength(schema.maxLength));
  if (schema.pattern) rules.push(t.pattern(schema.pattern));
  if (!rules.length && !schema.enum && schema.default === undefined && schema.example === undefined) return null;
  return (
    <dl className="ds-schema__facts">
      {schema.enum && (
        <div><dt>{t.values}</dt><dd>{schema.enum.map((value) => <code key={String(value)}>{format(value)}</code>)}</dd></div>
      )}
      {schema.default !== undefined && <div><dt>{t.defaultValue}</dt><dd><code>{format(schema.default)}</code></dd></div>}
      {schema.example !== undefined && <div><dt>{t.example}</dt><dd><code>{format(schema.example)}</code></dd></div>}
      {rules.length > 0 && <div><dt>{t.rules}</dt><dd>{rules.join(' · ')}</dd></div>}
    </dl>
  );
}

/** "Expand all" / "Collapse all": every nested toggle follows the latest command. */
const ExpandAll = createContext<{ open: boolean; version: number } | null>(null);

function hasNested(schema: Schema): boolean {
  const root = expandable(schema);
  if (!root) return false;
  if (root.kind === 'variants') return true;
  return Object.values(root.schema.properties ?? {}).some((child) => expandable(child));
}

/** oneOf / anyOf: a row of buttons picks the variant shown; with a discriminator, its values label them. */
function Variants({ schema, depth, expandDepth }: { schema: Schema; depth: number; expandDepth: number }) {
  const t = useDsMessages();
  const options = variantsOf(schema) ?? [];
  const [index, setIndex] = useState(0);
  const labelId = useId();
  const discriminator = schema.discriminator;
  const label = (option: Schema, position: number) => {
    const key = Object.entries(discriminator?.mapping ?? {}).find(([, ref]) => ref.split('/').pop() === option.title)?.[0];
    return key ?? option.title ?? t.option(position + 1);
  };
  const selected = mergeSchema(options[Math.min(index, options.length - 1)] ?? {});
  const fields = expandable(selected);
  return (
    <div className={cx('ds-schema__variants', depth > 0 && 'ds-schema__variants--nested')}>
      <div className="ds-schema__variants-head">
        <span id={labelId} className="ds-schema__variants-label">{schema.oneOf ? t.oneOf : t.anyOf}</span>
        <div className="ds-schema__variant-list" role="group" aria-labelledby={labelId}>
          {options.map((option, position) => (
            <button key={position} type="button" className="ds-schema__variant" aria-pressed={position === index} onClick={() => setIndex(position)}>
              {label(option, position)}
            </button>
          ))}
        </div>
      </div>
      {discriminator && <p className="ds-schema__variants-hint">{t.discriminatedBy(discriminator.propertyName)}</p>}
      {selected.description && <p className="ds-schema__description">{selected.description}</p>}
      {fields?.kind === 'fields'
        ? <PropertyList schema={fields.schema} depth={depth + 1} expandDepth={expandDepth} />
        : fields?.kind === 'variants'
          ? <Variants schema={fields.schema} depth={depth + 1} expandDepth={expandDepth} />
          : <p className="ds-schema__root"><code>{typeLabel(selected)}</code></p>}
    </div>
  );
}

function Property({ name, schema, required, depth, expandDepth }: { name: string; schema: Schema; required: boolean; depth: number; expandDepth: number }) {
  const nested = expandable(schema);
  const circular = circularName(schema);
  const [open, setOpen] = useState(depth < expandDepth);
  const command = useContext(ExpandAll);
  useEffect(() => { if (command) setOpen(command.open); }, [command]);
  const listId = useId();
  const count = nested?.kind === 'fields' ? Object.keys(nested.schema.properties ?? {}).length : (variantsOf(nested?.schema ?? {}) ?? []).length;
  const t = useDsMessages();
  return (
    <li className="ds-schema__property">
      <div className="ds-schema__head">
        <code className="ds-schema__name">{name}</code>
        <span className="ds-schema__type">{typeLabel(schema)}</span>
        {required ? <span className="ds-schema__required">{t.required}</span> : <span className="ds-schema__optional">{t.optional}</span>}
        {schema.readOnly && <span className="ds-schema__flag">{t.readOnly}</span>}
        {schema.writeOnly && <span className="ds-schema__flag">{t.writeOnly}</span>}
        {schema.deprecated && <span className="ds-schema__flag ds-schema__flag--warning">{t.deprecatedFlag}</span>}
        {circular && <span className="ds-schema__flag" title={t.circularHint(circular)}>{t.circular}</span>}
      </div>
      {schema.description && <p className="ds-schema__description">{schema.description}</p>}
      {circular && <p className="ds-schema__circular">{t.circularHint(circular)}</p>}
      <Constraints schema={schema} />
      {nested && (
        <>
          <button type="button" className="ds-schema__toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
            <ChevronRight className="ds-schema__chevron" aria-hidden="true" />
            {nested.kind === 'fields' ? t.toggleProperties(open, count) : t.toggleVariants(open, count)}
            <span className="ds-sr-only">{t.ofProperty(name)}</span>
          </button>
          <div id={listId} hidden={!open}>
            {open && (nested.kind === 'fields'
              ? <PropertyList schema={nested.schema} depth={depth + 1} expandDepth={expandDepth} />
              : <Variants schema={nested.schema} depth={depth + 1} expandDepth={expandDepth} />)}
          </div>
        </>
      )}
    </li>
  );
}

function PropertyList({ schema, depth, expandDepth }: { schema: Schema; depth: number; expandDepth: number }) {
  const required = new Set(schema.required ?? []);
  return (
    <ul role="list" className={cx('ds-schema__list', depth > 0 && 'ds-schema__list--nested')}>
      {Object.entries(schema.properties ?? {}).map(([name, child]) => (
        <Property key={name} name={name} schema={child} required={required.has(name)} depth={depth} expandDepth={expandDepth} />
      ))}
    </ul>
  );
}

export interface SchemaViewerProps {
  schema: Schema;
  /** Nested objects open up to this depth (default 1: only the top level). */
  expandDepth?: number;
  className?: string;
}

/**
 * Tree of fields from a JSON/OpenAPI schema: name, type, required, description, enums and rules.
 * Nested objects expand with real buttons (aria-expanded + aria-controls), so the tree reads as lists.
 */
export function SchemaViewer({ schema: input, expandDepth = 1, className }: SchemaViewerProps) {
  const t = useDsMessages();
  const schema = mergeSchema(input);
  const root = expandable(schema);
  const [command, setCommand] = useState<{ open: boolean; version: number } | null>(null);
  const allOpen = command?.open ?? false;
  return (
    <ExpandAll.Provider value={command}>
    <div className={cx('ds-schema', className)}>
      {hasNested(schema) && (
        <button type="button" className="ds-schema__expand-all" onClick={() => setCommand({ open: !allOpen, version: (command?.version ?? 0) + 1 })}>
          {allOpen ? t.collapseAll : t.expandAll}
        </button>
      )}
      {schema.type === 'array' && <p className="ds-schema__root">{t.listOf} <code>{schema.items ? typeLabel(schema.items) : t.items}</code></p>}
      {root?.kind === 'fields' && <PropertyList schema={root.schema} depth={0} expandDepth={expandDepth} />}
      {root?.kind === 'variants' && <Variants schema={root.schema} depth={0} expandDepth={expandDepth} />}
      {!root && schema.type !== 'array' && <p className="ds-schema__root"><code>{typeLabel(schema)}</code>{schema.description && ` · ${schema.description}`}</p>}
    </div>
    </ExpandAll.Provider>
  );
}
