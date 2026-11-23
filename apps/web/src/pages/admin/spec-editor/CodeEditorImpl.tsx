import { useEffect, useRef } from 'react';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import {
  EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder as placeholderText,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { markdown } from '@codemirror/lang-markdown';
import { linter, lintGutter, lintKeymap, type Diagnostic } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { cx } from '../../../design-system';
import type { CodeEditorProps, CodeLanguage } from './CodeEditor';

/** Colors from the design system's code tokens, so light and dark themes just work. */
const highlight = HighlightStyle.define([
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: 'var(--code-attr)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: tags.number, color: 'var(--code-number)' },
  { tag: [tags.bool, tags.null, tags.keyword, tags.atom], color: 'var(--code-keyword)' },
  { tag: [tags.comment, tags.lineComment, tags.meta], color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: [tags.heading], color: 'var(--code-attr)', fontWeight: '600' },
  { tag: [tags.emphasis], fontStyle: 'italic' },
  { tag: [tags.strong], fontWeight: '600' },
  { tag: [tags.link, tags.url], color: 'var(--code-string)', textDecoration: 'underline' },
  { tag: [tags.monospace], color: 'var(--code-number)' },
  { tag: [tags.brace, tags.squareBracket, tags.separator, tags.punctuation], color: 'var(--code-fg)' },
]);

const languageFor = (language: CodeLanguage) => (language === 'json' ? json() : language === 'yaml' ? yaml() : markdown());

/**
 * CodeMirror editor for YAML, JSON or Markdown: highlighting, line numbers, folding, inline lint
 * with a gutter, autocomplete, and Mod-S for saving. Tab indents; Esc then Tab leaves the editor.
 */
export default function CodeEditorImpl({ value, onChange, language, label, lint, completion, onSave, onReady, placeholder, describedBy, className }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const props = useRef({ onChange, lint, onSave });
  props.current = { onChange, lint, onSave };
  const languageSlot = useRef(new Compartment());
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
          languageSlot.current.of(languageFor(language)),
          syntaxHighlighting(highlight),
          indentUnit.of('  '),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          linter((current) => {
            const check = props.current.lint;
            if (!check) return [];
            const length = current.state.doc.length;
            return check(current.state.doc.toString()).map((issue): Diagnostic => {
              const from = Math.min(issue.from, length);
              // Zero-width issues (missing fields) underline the rest of the line.
              const to = issue.to > issue.from ? Math.min(issue.to, length) : current.state.doc.lineAt(from).to;
              return { from, to: Math.max(to, from), severity: issue.severity, message: issue.message };
            });
          }, { delay: 350 }),
          ...(completion ? [autocompletion({ override: [completion], icons: false })] : []),
          keymap.of([
            { key: 'Mod-s', preventDefault: true, run: () => { props.current.onSave?.(); return true; } },
            ...closeBracketsKeymap, ...completionKeymap, ...lintKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab,
          ]),
          ...(placeholder ? [placeholderText(placeholder)] : []),
          attributes.current.of(EditorView.contentAttributes.of({})),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) props.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    onReady?.({
      goTo: (offset: number) => {
        const position = Math.min(offset, editor.state.doc.length);
        editor.dispatch({ selection: EditorSelection.cursor(position), effects: EditorView.scrollIntoView(position, { y: 'center' }) });
        editor.focus();
      },
      insert: (text: string) => {
        editor.dispatch(editor.state.replaceSelection(text));
        editor.focus();
      },
    });
    return () => { editor.destroy(); view.current = null; };
    // Created once; value, language and attributes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside changes (import, convert, discard) replace the document, keeping undo history.
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value) editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: languageSlot.current.reconfigure(languageFor(language)) });
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({
      effects: attributes.current.reconfigure(EditorView.contentAttributes.of({
        'aria-label': label,
        'aria-multiline': 'true',
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })),
    });
  }, [label, describedBy]);

  return <div ref={host} className={cx('ds-json-editor', 'code-editor', className)} />;
}
