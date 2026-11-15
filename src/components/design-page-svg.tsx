// packages/ai-ui/src/components/design-page-svg.tsx
import type { ComponentProps, ReactNode } from "react";

import { type DesignElement, type DesignPage, polygonPoints, round, wrapText } from "../lib/design/geometry.js";
import { safeImageSrc } from "../lib/safe-url.js";

const COLOR = /^(#[0-9a-f]{3,8}|(?:rgb|hsl|oklch|oklab|lab|lch)a?\([\d\s.,%/+-]+\)|[a-z]+|transparent|none)$/i;

/** Accepts plain CSS colors only, so design data cannot smuggle url() references into exports. */
export function safeColor(value: string | undefined, fallback = "none"): string {
  return value && COLOR.test(value.trim()) ? value.trim() : fallback;
}

function arrowHead(element: DesignElement): string {
  const x2 = element.x + element.width;
  const y2 = element.y + element.height;
  const angle = Math.atan2(element.height, element.width);
  const size = Math.max(8, (element.strokeWidth ?? 2) * 4);
  const left = { x: x2 - size * Math.cos(angle - Math.PI / 7), y: y2 - size * Math.sin(angle - Math.PI / 7) };
  const right = { x: x2 - size * Math.cos(angle + Math.PI / 7), y: y2 - size * Math.sin(angle + Math.PI / 7) };
  return `${round(x2)},${round(y2)} ${round(left.x)},${round(left.y)} ${round(right.x)},${round(right.y)}`;
}

export function DesignElementShape({ element }: { element: DesignElement }): ReactNode {
  if (element.hidden) return null;
  const rotation = element.rotation ? `rotate(${element.rotation} ${round(element.x + element.width / 2)} ${round(element.y + element.height / 2)})` : undefined;
  const common = {
    fill: safeColor(element.fill, "none"),
    stroke: safeColor(element.stroke, "none"),
    strokeWidth: element.strokeWidth ?? 0,
    opacity: element.opacity ?? 1,
    transform: rotation,
  };
  switch (element.kind) {
    case "rect":
      return <rect x={element.x} y={element.y} width={Math.max(0, element.width)} height={Math.max(0, element.height)} rx={element.radius ?? 0} {...common} />;
    case "ellipse":
      return <ellipse cx={element.x + element.width / 2} cy={element.y + element.height / 2} rx={Math.abs(element.width / 2)} ry={Math.abs(element.height / 2)} {...common} />;
    case "triangle":
    case "diamond":
    case "star":
      return <polygon points={polygonPoints(element)} strokeLinejoin="round" {...common} />;
    case "line":
    case "arrow": {
      const stroke = safeColor(element.stroke, "#111111");
      return (
        <g opacity={element.opacity ?? 1}>
          <line x1={element.x} y1={element.y} x2={element.x + element.width} y2={element.y + element.height} stroke={stroke} strokeWidth={element.strokeWidth ?? 2} strokeLinecap="round" />
          {element.kind === "arrow" && <polygon points={arrowHead(element)} fill={stroke} />}
        </g>
      );
    }
    case "text": {
      const fontSize = element.fontSize ?? 24;
      const lineHeight = (element.lineHeight ?? 1.25) * fontSize;
      const align = element.textAlign ?? "left";
      const x = align === "center" ? element.x + element.width / 2 : align === "right" ? element.x + element.width : element.x;
      const lines = wrapText(element.text ?? "", element.width, { fontSize, fontWeight: element.fontWeight ?? 400, fontFamily: element.fontFamily ?? "system-ui, sans-serif" });
      return (
        <text
          x={x}
          y={element.y}
          fontSize={fontSize}
          fontWeight={element.fontWeight ?? 400}
          fontFamily={element.fontFamily ?? "system-ui, sans-serif"}
          fill={safeColor(element.color, "#111111")}
          textAnchor={align === "center" ? "middle" : align === "right" ? "end" : "start"}
          opacity={element.opacity ?? 1}
          transform={rotation}
          style={{ whiteSpace: "pre" }}
        >
          {lines.map((line, index) => (
            <tspan key={index} x={x} y={round(element.y + fontSize * 0.9 + index * lineHeight)}>
              {line || " "}
            </tspan>
          ))}
        </text>
      );
    }
    case "image": {
      const src = safeImageSrc(element.src);
      if (!src) return <rect x={element.x} y={element.y} width={element.width} height={element.height} fill="#e5e7eb" transform={rotation} />;
      return <image href={src} x={element.x} y={element.y} width={element.width} height={element.height} preserveAspectRatio="xMidYMid slice" opacity={element.opacity ?? 1} transform={rotation} />;
    }
  }
}

export interface DesignPageSvgProps extends Omit<ComponentProps<"svg">, "children"> {
  page: DesignPage;
  width: number;
  height: number;
  /** Extra layers drawn above the content, such as selection handles. */
  children?: ReactNode;
}

/** Renders a design page as SVG; also used for thumbnails, the read-only viewer and exports. */
export function DesignPageSvg({ page, width, height, children, ...props }: DesignPageSvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} {...props}>
      <g data-content="">
        <rect width={width} height={height} fill={safeColor(page.background, "#ffffff")} />
        {page.elements.map((element) => (
          <DesignElementShape key={element.id} element={element} />
        ))}
      </g>
      {children}
    </svg>
  );
}
