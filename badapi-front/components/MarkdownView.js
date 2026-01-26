"use client";

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const renderInline = (value) => {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return output;
};

const renderMarkdown = (text) => {
  const lines = text.split("\n");
  const html = [];
  let listOpen = false;
  let codeOpen = false;

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (!codeOpen) {
        codeOpen = true;
        html.push("<pre><code>");
      } else {
        codeOpen = false;
        html.push("</code></pre>");
      }
      return;
    }

    if (codeOpen) {
      html.push(escapeHtml(line));
      return;
    }

    if (line.startsWith("### ")) {
      html.push(`<h3>${renderInline(line.slice(4))}</h3>`);
      return;
    }
    if (line.startsWith("## ")) {
      html.push(`<h2>${renderInline(line.slice(3))}</h2>`);
      return;
    }
    if (line.startsWith("# ")) {
      html.push(`<h1>${renderInline(line.slice(2))}</h1>`);
      return;
    }

    if (line.startsWith("- ")) {
      if (!listOpen) {
        listOpen = true;
        html.push("<ul>");
      }
      html.push(`<li>${renderInline(line.slice(2))}</li>`);
      return;
    }

    if (listOpen) {
      listOpen = false;
      html.push("</ul>");
    }

    if (line.trim() === "") {
      html.push("<br />");
      return;
    }

    html.push(`<p>${renderInline(line)}</p>`);
  });

  if (listOpen) html.push("</ul>");
  if (codeOpen) html.push("</code></pre>");

  return html.join("");
};

export default function MarkdownView({ content }) {
  const html = renderMarkdown(content || "");
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
