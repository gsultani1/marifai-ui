// packages/ai-ui/src/components/template-gallery.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { button, buttonVariants, card, focusRing, iconButton, modalBackdrop, modalPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { FilterChips } from "./filter-chips.js";
import { FormField, TextInput } from "./form-field.js";
import { SearchInput } from "./search-input.js";

export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  /** Prompt text; `{{name}}` marks a value the user fills in before using it. */
  prompt: string;
  category?: string;
  tags?: string[];
  icon?: ReactNode;
}

const VARIABLE = /\{\{\s*([\w .-]+?)\s*\}\}/g;

/** Unique variable names in a template, in order of appearance. */
export function templateVariables(prompt: string): string[] {
  return [...new Set([...prompt.matchAll(VARIABLE)].map((match) => match[1]!))];
}

/** Template with each `{{name}}` replaced; unfilled names are left as they are. */
export function fillTemplate(prompt: string, values: Record<string, string>): string {
  return prompt.replace(VARIABLE, (whole, name: string) => (values[name]?.trim() ? values[name]!.trim() : whole));
}

const humanize = (name: string) => name.replace(/[_.-]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());

export interface TemplateGalleryProps {
  templates: PromptTemplate[];
  /** Receives the finished prompt, with variables filled in. */
  onUse: (prompt: string, template: PromptTemplate) => void;
  label?: string;
  className?: string;
}

/**
 * Searchable prompt templates grouped by category. Templates with
 * `{{variables}}` open a short form with a live preview before use.
 */
export function TemplateGallery({ templates, onUse, label = "Prompt templates", className }: TemplateGalleryProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const container = usePortalContainer();
  const categories = [...new Set(templates.map((template) => template.category).filter((name): name is string => Boolean(name)))];
  const search = query.trim().toLowerCase();
  const visible = templates.filter((template) => (!category.length || category.includes(template.category ?? "")) && (!search || [template.title, template.description ?? "", template.prompt, ...(template.tags ?? [])].some((text) => text.toLowerCase().includes(search))));
  const variables = selected ? templateVariables(selected.prompt) : [];

  const choose = (template: PromptTemplate) => {
    if (templateVariables(template.prompt).length === 0) onUse(template.prompt, template);
    else {
      setValues({});
      setSelected(template);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selected) return;
    onUse(fillTemplate(selected.prompt, values), selected);
    setSelected(null);
  };

  return (
    <section aria-label={label} className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput label="Search templates" placeholder="Search templates" value={query} onValueChange={setQuery} resultCount={visible.length} className="w-64" />
        {categories.length > 1 && <FilterChips label="Template categories" multiple={false} value={category} onValueChange={setCategory} options={categories.map((name) => ({ value: name, label: name, count: templates.filter((template) => template.category === name).length }))} />}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates match.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((template) => (
            <li key={template.id}>
              <button type="button" onClick={() => choose(template)} className={cn(card, "flex h-full w-full flex-col gap-1 p-3 text-left text-sm transition-colors hover:bg-accent/40", focusRing)}>
                <span className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
                  {template.icon}
                  {template.title}
                </span>
                {template.description && <span className="text-muted-foreground">{template.description}</span>}
                {(template.category || template.tags?.length) && (
                  <span className="mt-auto flex flex-wrap gap-1 pt-1">
                    {[template.category, ...(template.tags ?? [])].filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog.Root open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <Dialog.Portal container={container}>
          <Dialog.Backdrop className={modalBackdrop} />
          <Dialog.Popup className={cn(modalPopup, "w-[min(32rem,calc(100vw-2rem))]")}>
            {selected && (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <Dialog.Title className="text-base font-semibold">{selected.title}</Dialog.Title>
                    <Dialog.Description className="text-sm text-muted-foreground">Fill in the details, then use the prompt.</Dialog.Description>
                  </div>
                  <Dialog.Close aria-label="Close" className={cn(iconButton, focusRing)}>
                    <XIcon aria-hidden="true" />
                  </Dialog.Close>
                </div>
                {variables.map((name, index) => (
                  <FormField key={name} label={humanize(name)}>
                    <TextInput autoFocus={index === 0} value={values[name] ?? ""} onValueChange={(next: string) => setValues({ ...values, [name]: next })} />
                  </FormField>
                ))}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Preview</span>
                  <p className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/40 p-2 text-sm whitespace-pre-wrap">{fillTemplate(selected.prompt, values)}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Dialog.Close className={cn(button, buttonVariants.outline, focusRing)}>Cancel</Dialog.Close>
                  <button type="submit" disabled={variables.some((name) => !values[name]?.trim())} className={cn(button, buttonVariants.primary, focusRing)}>
                    Use prompt
                  </button>
                </div>
              </form>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
