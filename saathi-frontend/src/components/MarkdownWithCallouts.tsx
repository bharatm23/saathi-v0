"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders markdown with our `> [!positive]` and `> [!caution]` callout syntax.
 * Any `> [!kind] content` blockquote becomes a coloured callout via the
 * `.prose-saathi blockquote.{positive|caution}` classes in globals.css.
 */
export function MarkdownWithCallouts({ children }: { children: string }) {
  return (
    <div className="prose-saathi">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          blockquote({ children, ...props }) {
            // crude but sufficient: sniff the first text child for [!kind]
            const str = JSON.stringify(children);
            let cls = "";
            if (str.includes("[!positive]")) cls = "positive";
            else if (str.includes("[!caution]")) cls = "caution";
            return (
              <blockquote className={cls} {...props}>
                {stripMarker(children)}
              </blockquote>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function stripMarker(children: React.ReactNode): React.ReactNode {
  // Walk one level deep and replace the [!kind] marker text. Sufficient for
  // the GFM-ish output we produce; swap for a proper remark plugin later.
  if (!Array.isArray(children)) return children;
  return children.map((child, i) => {
    if (typeof child === "string") {
      return child.replace(/\[!(positive|caution|info)\]\s*/g, "");
    }
    if (child && typeof child === "object" && "props" in (child as object)) {
      const el = child as React.ReactElement;
      if (el.props && Array.isArray(el.props.children)) {
        const newChildren = el.props.children.map((c: React.ReactNode) =>
          typeof c === "string" ? c.replace(/\[!(positive|caution|info)\]\s*/g, "") : c
        );
        return { ...el, props: { ...el.props, children: newChildren }, key: i };
      }
    }
    return child;
  });
}
