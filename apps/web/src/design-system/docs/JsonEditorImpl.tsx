import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder as placeholderText } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { cx } from '../cx';

/** Syntax colors from the code tokens (the same ones CodeBlock uses), so light and dark just work. */
const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--code-attr)' },
  { tag: tags.string, color: 'var(--code-string)' },
  { tag: tags.number, color: 'var(--code-number)' },
  { tag: [tags.bool, tags.null], color: 'var(--code-keyword)' },
  { tag: [tags.brace, tags.squareBracket, tags.separator, tags.punctuation], color: 'var(--code-fg)' },
]);

import type { JsonEditorProps } from './JsonEditor';


/**
 * JSON editor (CodeMirror 6): syntax highlighting with the code tokens, line numbers, folding,
 * auto-closing brackets and quotes, auto-indent, bracket matching, undo/redo and inline lint
 * for invalid JSON. Tab is left to the browser so keyboard users can move past the editor.
 */
export default function JsonEditorImpl({ value, onChange, label, invalid = false, describedBy, placeholder, readOnly = false, className }: JsonEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const attributes = useRef(new Compartment());

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          foldGutter({ markerDOM: (open) => Object.assign(document.createElement('span'), { className: cx('ds-json-editor__fold', open && 'is-open'), textContent: '›' }) }),
          lintGutter(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          json(),
          linter(jsonParseLinter(), { delay: 300 }),
          syntaxHighlighting(highlight),
          EditorState.tabSize.of(2),
          EditorState.readOnly.of(readOnly),
          // Mod-Enter is left for the surrounding form (e.g. "send"), instead of inserting a blank line.
          keymap.of([{ key: 'Mod-Enter', run: () => true }, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap]),
          ...(placeholder ? [placeholderText(placeholder)] : []),
          attributes.current.of(EditorView.contentAttributes.of({})),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
    // The editor is created once; value and attributes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside changes (e.g. "Formatar") replace the document without breaking undo history.
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value) editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: attributes.current.reconfigure(EditorView.contentAttributes.of({
        'aria-label': label,
        'aria-multiline': 'true',
        ...(invalid ? { 'aria-invalid': 'true' } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })),
    });
  }, [label, invalid, describedBy]);

  return <div ref={host} className={cx('ds-json-editor', invalid && 'is-invalid', className)} />;
}
