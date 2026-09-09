import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FairyMessageContent } from "./FairyMessageContent.ts";

function render(content) {
  return renderToStaticMarkup(createElement(FairyMessageContent, { content }));
}

test("Fairy renders Turkish emphasis, paragraphs and lists as semantic elements", () => {
  const html = render("**Bugünün odağı**\n\n*Öneri:* Firma kaydını inceleyin.\n\n- Bekleyen fırsat\n- Fuar hazırlığı\n\n1. Kaydı kontrol edin.\n2. Önceliği değerlendirin.");
  assert.match(html, /<strong>Bugünün odağı<\/strong>/);
  assert.match(html, /<em>Öneri:<\/em>/);
  assert.match(html, /<ul>\s*<li>Bekleyen fırsat<\/li>\s*<li>Fuar hazırlığı<\/li>\s*<\/ul>/);
  assert.match(html, /<ol>\s*<li>Kaydı kontrol edin\.<\/li>\s*<li>Önceliği değerlendirin\.<\/li>\s*<\/ol>/);
  assert.doesNotMatch(html, /\*\*|\n- |\n1\./);
});

test("Fairy decodes HTML entities as text without reparsing them as HTML", () => {
  const html = render("Firma&#x20;bilgisi &amp; fuar&#32;durumu\n\n&lt;img src=x onerror=alert(1)&gt;");
  assert.match(html, /Firma bilgisi &amp; fuar durumu/);
  assert.doesNotMatch(html, /&#x20;|&#32;|<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("Fairy handles escaped punctuation without altering intentional literal formatting", () => {
  const html = render(String.raw`1\. Sıra

\- Kısa not

\*\*Yıldızlı metin\*\*`);
  assert.match(html, /<p>1\. Sıra<\/p>/);
  assert.match(html, /<p>- Kısa not<\/p>/);
  assert.match(html, /<p>\*\*Yıldızlı metin\*\*<\/p>/);
  assert.doesNotMatch(html, /\\/);
});

test("Fairy preserves Markdown and HTML literals inside code", () => {
  const html = render('`**literal** &#x20;`\n\n```html\n<script>alert(1)</script>\n```');
  assert.match(html, /<code>\*\*literal\*\* &amp;#x20;<\/code>/);
  assert.match(html, /<pre><code class="language-html">&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script/);
});

test("Fairy ignores raw HTML and does not create executable elements or handlers", () => {
  const html = render('Güvenli metin <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n<iframe src="https://example.com"></iframe>\n\n<svg onload=alert(1)></svg>\n\n**Sonuç**');
  assert.match(html, /Güvenli metin/);
  assert.match(html, /<strong>Sonuç<\/strong>/);
  assert.doesNotMatch(html, /<(?:script|img|iframe|svg)|onerror=|onload=|alert\(1\)/i);
});

test("Fairy suppresses Markdown images rather than fetching remote content", () => {
  const html = render("Özet ![izleme](https://example.com/pixel.png) tamamlandı.");
  assert.doesNotMatch(html, /<img|src=|example\.com/);
  assert.match(html, /tamamlandı/);
});

for (const destination of ["javascript:alert%281%29", "JaVaScRiPt:alert%281%29", "javascript&#58;alert%281%29", "data:text/html,test", "vbscript:msgbox%281%29"]) {
  test(`Fairy blocks unsafe Markdown link destination: ${destination.split(":")[0]}`, () => {
    const html = render(`[Bağlantı](${destination})`);
    assert.match(html, />Bağlantı<\/a>/);
    assert.doesNotMatch(html, /href="(?:javascript|data|vbscript):/i);
  });
}

test("Fairy retains normal HTTPS links and headings without changing answer text", () => {
  const html = render("### Kayıt özeti\n\n[Kaydı aç](https://example.com/company?id=1)\n\nHenüz yeterli bilgi yok.");
  assert.match(html, /<h3>Kayıt özeti<\/h3>/);
  assert.match(html, /<a href="https:\/\/example\.com\/company\?id=1">Kaydı aç<\/a>/);
  assert.match(html, /<p>Henüz yeterli bilgi yok\.<\/p>/);
});
