// packages/ai-ui/src/lib/file-tree.ts
export type FileChangeStatus = "added" | "modified" | "deleted" | "renamed" | "untracked" | "conflicted";

export interface FileTreeEntry {
  /** Slash-separated path relative to the workspace root, e.g. "src/app.tsx". Folders may end in "/". */
  path: string;
  status?: FileChangeStatus;
  /** Edited and not saved yet. */
  unsaved?: boolean;
  /** Protected from edits, e.g. by the user or another agent. */
  locked?: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  kind: "file" | "folder";
  children: FileTreeNode[];
  entry?: FileTreeEntry;
  /** Changed files below a folder, for its badge. */
  changes: number;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\/+/, "").replace(/\/{2,}/g, "/");
}

export function parentPath(path: string): string {
  const clean = normalizePath(path).replace(/\/$/, "");
  const index = clean.lastIndexOf("/");
  return index === -1 ? "" : clean.slice(0, index);
}

export function baseName(path: string): string {
  const clean = normalizePath(path).replace(/\/$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1);
}

/** Every folder above a path, outermost first: "a/b/c.ts" gives ["a", "a/b"]. */
export function ancestorPaths(path: string): string[] {
  const parts = normalizePath(path).replace(/\/$/, "").split("/");
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
}

function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index]!;
    if (char === "*") {
      if (glob[index + 1] === "*") {
        source += glob[index + 2] === "/" ? "(?:.*/)?" : ".*";
        index += glob[index + 2] === "/" ? 2 : 1;
      } else source += "[^/]*";
    } else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

/**
 * Gitignore-style matching: "node_modules/" hides that folder anywhere,
 * "*.log" matches by name at any depth, "/dist" or "build/out" match from
 * the root, "**" crosses folders and a leading "!" re-includes.
 */
export function createIgnoreMatcher(patterns: string[]): (path: string) => boolean {
  const rules = patterns
    .map((raw) => raw.trim())
    .filter((raw) => raw && !raw.startsWith("#"))
    .map((raw) => {
      const negate = raw.startsWith("!");
      let pattern = negate ? raw.slice(1) : raw;
      const folderOnly = pattern.endsWith("/");
      pattern = pattern.replace(/\/$/, "");
      const anchored = pattern.startsWith("/") || pattern.includes("/");
      pattern = pattern.replace(/^\//, "");
      return { negate, folderOnly, regex: globToRegExp(anchored ? pattern : `**/${pattern}`) };
    });
  return (path) => {
    const parts = normalizePath(path).replace(/\/$/, "").split("/");
    let ignored = false;
    for (const rule of rules) {
      for (let depth = 1; depth <= parts.length; depth++) {
        const candidate = parts.slice(0, depth).join("/");
        const isFolder = depth < parts.length || path.endsWith("/");
        if (rule.folderOnly && !isFolder) continue;
        if (rule.regex.test(candidate)) {
          ignored = !rule.negate;
          break;
        }
      }
    }
    return ignored;
  };
}

/** Builds a sorted tree (folders first, natural order) from flat paths, skipping ignored ones. */
export function buildFileTree(entries: FileTreeEntry[], ignore: string[] = []): FileTreeNode[] {
  const isIgnored = createIgnoreMatcher(ignore);
  const root: FileTreeNode = { name: "", path: "", kind: "folder", children: [], changes: 0 };
  const folders = new Map<string, FileTreeNode>([["", root]]);

  const folderFor = (path: string): FileTreeNode => {
    const existing = folders.get(path);
    if (existing) return existing;
    const parent = folderFor(parentPath(path));
    const node: FileTreeNode = { name: baseName(path), path, kind: "folder", children: [], changes: 0 };
    parent.children.push(node);
    folders.set(path, node);
    return node;
  };

  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (!path || isIgnored(path)) continue;
    if (path.endsWith("/")) {
      const folder = folderFor(path.slice(0, -1));
      folder.entry = { ...entry, path: folder.path };
      continue;
    }
    const parent = folderFor(parentPath(path));
    if (parent.children.some((child) => child.path === path)) continue;
    parent.children.push({ name: baseName(path), path, kind: "file", children: [], entry: { ...entry, path }, changes: 0 });
    if (entry.status) for (const ancestor of ["", ...ancestorPaths(path)]) folders.get(ancestor)!.changes++;
  }

  const sort = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => (a.kind === b.kind ? collator.compare(a.name, b.name) : a.kind === "folder" ? -1 : 1));
    for (const node of nodes) sort(node.children);
  };
  sort(root.children);
  return root.children;
}

export interface VisibleNode {
  node: FileTreeNode;
  level: number;
  setSize: number;
  position: number;
  parent: string;
}

/** Nodes on screen given the expanded folders, in display order, with ARIA tree positions. */
export function visibleNodes(nodes: FileTreeNode[], expanded: ReadonlySet<string>, level = 1, parent = ""): VisibleNode[] {
  return nodes.flatMap((node, index) => [
    { node, level, setSize: nodes.length, position: index + 1, parent },
    ...(node.kind === "folder" && expanded.has(node.path) ? visibleNodes(node.children, expanded, level + 1, node.path) : []),
  ]);
}

/** Finds a node by path. */
export function findNode(nodes: FileTreeNode[], path: string): FileTreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.kind === "folder" && path.startsWith(`${node.path}/`)) return findNode(node.children, path);
  }
  return undefined;
}

/** Rejects names that would escape the folder or are invalid on common file systems. */
export function validateFileName(name: string, siblings: string[] = []): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a name.";
  if (trimmed === "." || trimmed === "..") return "That name is reserved.";
  if (/[\\:*?"<>|]/.test(trimmed) || trimmed.split("/").some((part) => !part || part === "." || part === "..")) return 'Names can\'t contain \\ : * ? " < > | or empty folders.';
  if (siblings.some((sibling) => sibling.toLowerCase() === trimmed.toLowerCase())) return `"${trimmed}" already exists here.`;
  return null;
}
