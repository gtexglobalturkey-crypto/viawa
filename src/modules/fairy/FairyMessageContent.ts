import { createElement } from "react";
import Markdown from "react-markdown";

const allowedElements = [
  "p", "strong", "em", "ul", "ol", "li", "blockquote", "pre", "code",
  "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "a",
];

export function FairyMessageContent({ content }: { content: string }) {
  return createElement(
    "div",
    { className: "fairy-message-content fairy-markdown" },
    // Keep Markdown's safe URL handling; raw HTML and remote images are excluded.
    createElement(Markdown, { children: content, skipHtml: true, allowedElements }),
  );
}
