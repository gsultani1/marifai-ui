// packages/ai-ui/src/lib/preview-inspector.ts
/** Message source posted by scripts running inside preview frames. */
export const PREVIEW_MESSAGE_SOURCE = "ai-ui-preview";
/** Message source the host uses when it talks to a preview frame. */
export const PREVIEW_HOST_SOURCE = "ai-ui-host";

export interface InspectedElement {
  tagName: string;
  id: string;
  classes: string[];
  /** Visible text, whitespace collapsed, up to 300 characters. */
  text: string;
  /** CSS path that locates the element, anchored at the nearest id. */
  selector: string;
  /** Markup, up to 2000 characters. */
  html: string;
  /** Position in the frame's viewport. */
  rect: { x: number; y: number; width: number; height: number };
  /** A few identifying attributes such as href, src, alt, role and aria-label. */
  attributes: Record<string, string>;
  /** Path of the page in the frame. */
  path: string;
}

export type InspectorMessage = { type: "inspect"; element: InspectedElement } | { type: "inspect-cancel" } | { type: "inspector-ready" };

const INSPECTOR = `(function(){var S="${PREVIEW_MESSAGE_SOURCE}",H="${PREVIEW_HOST_SOURCE}",on=false,box=null,tag=null,cur=null;
function post(m){try{m.source=S;parent.postMessage(m,"*")}catch(e){}}
function esc(v){return window.CSS&&CSS.escape?CSS.escape(v):v.replace(/[^a-zA-Z0-9_-]/g,"\\\\$&")}
function sel(el){var parts=[];while(el&&el.nodeType===1&&parts.length<6){var p=el.tagName.toLowerCase();if(el.id){parts.unshift(p+"#"+esc(el.id));break}var up=el.parentElement;if(up){var same=Array.prototype.filter.call(up.children,function(c){return c.tagName===el.tagName});if(same.length>1)p+=":nth-of-type("+(same.indexOf(el)+1)+")"}parts.unshift(p);if(el===document.body)break;el=up}return parts.join(" > ")}
function describe(el){var r=el.getBoundingClientRect(),a={};["href","src","alt","role","aria-label","name","type","placeholder","data-testid"].forEach(function(n){var v=el.getAttribute(n);if(v!==null)a[n]=v.slice(0,200)});return{tagName:el.tagName.toLowerCase(),id:el.id||"",classes:Array.prototype.slice.call(el.classList,0,20),text:(el.innerText||el.textContent||"").replace(/\\s+/g," ").trim().slice(0,300),selector:sel(el),html:el.outerHTML.slice(0,2000),rect:{x:Math.round(r.left),y:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)},attributes:a,path:location.pathname}}
function show(el){if(!box){box=document.createElement("div");box.setAttribute("data-ai-ui-inspector","");box.style.cssText="position:fixed;pointer-events:none;z-index:2147483647;outline:2px solid #2563eb;background:rgba(37,99,235,.12);border-radius:2px";tag=document.createElement("div");tag.style.cssText="position:absolute;left:0;background:#1d4ed8;color:#fff;font:11px/1.6 ui-monospace,monospace;padding:0 4px;border-radius:2px;white-space:nowrap";box.appendChild(tag);document.documentElement.appendChild(box)}
cur=el;var r=el.getBoundingClientRect();box.style.left=r.left+"px";box.style.top=r.top+"px";box.style.width=r.width+"px";box.style.height=r.height+"px";
tag.textContent=el.tagName.toLowerCase()+(el.id?"#"+el.id:"")+(el.classList.length?"."+Array.prototype.slice.call(el.classList,0,2).join("."):"")+" "+Math.round(r.width)+"\\u00d7"+Math.round(r.height);
if(r.top<20){tag.style.bottom="auto";tag.style.top="100%"}else{tag.style.top="auto";tag.style.bottom="100%"}}
function hide(){if(box){box.remove();box=null;tag=null}cur=null}
function target(e){var el=e.target;return el&&el.nodeType===1&&!(box&&box.contains(el))?el:null}
function move(e){var el=target(e);if(el)show(el)}
function pick(e){var el=target(e);if(!el)return;e.preventDefault();e.stopPropagation();post({type:"inspect",element:describe(el)})}
function block(e){e.preventDefault();e.stopPropagation()}
function key(e){if(e.key==="Escape"){e.preventDefault();post({type:"inspect-cancel"})}else if(e.key==="Enter"&&cur){e.preventDefault();e.stopPropagation();post({type:"inspect",element:describe(cur)})}}
var events=[["mousemove",move],["click",pick],["mousedown",block],["mouseup",block],["submit",block],["keydown",key],["focusin",move]];
function set(next){if(next===on)return;on=next;events.forEach(function(p){window[next?"addEventListener":"removeEventListener"](p[0],p[1],true)});if(!next)hide();document.documentElement.style.cursor=next?"crosshair":""}
addEventListener("message",function(e){if(e.source!==parent)return;var d=e.data;if(d&&d.source===H&&d.type==="inspect")set(Boolean(d.enabled))});
post({type:"inspector-ready"})})();`;

/**
 * Script that lets the host pick elements in a preview: while inspecting,
 * hovering or focusing outlines an element and clicking or Enter reports
 * it. InteractivePreview adds it to `html` previews on its own; include it
 * in pages served to `src` previews to inspect those too.
 */
export const PREVIEW_INSPECTOR_SCRIPT = `<script>${INSPECTOR}</script>`;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Validates a message the inspector posted from a preview frame; anything else is null. */
export function readInspectorMessage(data: unknown): InspectorMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.source !== PREVIEW_MESSAGE_SOURCE) return null;
  if (record.type === "inspect-cancel" || record.type === "inspector-ready") return { type: record.type };
  if (record.type !== "inspect" || typeof record.element !== "object" || record.element === null) return null;
  const element = record.element as Record<string, unknown>;
  const tagName = text(element.tagName, 40);
  if (!/^[a-z][a-z0-9-]*$/.test(tagName)) return null;
  const rect = typeof element.rect === "object" && element.rect !== null ? (element.rect as Record<string, unknown>) : {};
  const attributes: Record<string, string> = {};
  if (typeof element.attributes === "object" && element.attributes !== null) {
    for (const [name, value] of Object.entries(element.attributes as Record<string, unknown>).slice(0, 12)) {
      if (typeof value === "string" && /^[a-z][a-z0-9-]*$/.test(name)) attributes[name] = value.slice(0, 200);
    }
  }
  return {
    type: "inspect",
    element: {
      tagName,
      id: text(element.id, 200),
      classes: Array.isArray(element.classes) ? element.classes.filter((value): value is string => typeof value === "string").slice(0, 20).map((value) => value.slice(0, 100)) : [],
      text: text(element.text, 300),
      selector: text(element.selector, 500),
      html: text(element.html, 2000),
      rect: { x: number(rect.x), y: number(rect.y), width: number(rect.width), height: number(rect.height) },
      attributes,
      path: text(element.path, 500),
    },
  };
}

/** Short name such as `button#save.primary`. */
export function inspectedElementName(element: InspectedElement): string {
  return `${element.tagName}${element.id ? `#${element.id}` : ""}${element.classes[0] ? `.${element.classes[0]}` : ""}`;
}

/** The selection written out for a prompt, so the model knows exactly which element the user means. */
export function describeInspectedElement(element: InspectedElement): string {
  return [
    `Selected element: <${inspectedElementName(element)}>${element.text ? ` "${element.text.slice(0, 120)}"` : ""}`,
    `Selector: ${element.selector}`,
    element.path ? `Page: ${element.path}` : "",
    `Size: ${element.rect.width}×${element.rect.height} at ${element.rect.x},${element.rect.y}`,
    `HTML: ${element.html}`,
  ]
    .filter(Boolean)
    .join("\n");
}
