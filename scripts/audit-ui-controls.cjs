const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const roots = ["apps/web/components", "apps/web/app"];
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith(".tsx")) files.push(fullPath);
  }
}

for (const root of roots) walk(root);

const findings = [];

function attribute(node, name) {
  return node.attributes.properties.find(
    (property) =>
      ts.isJsxAttribute(property) &&
      property.name.getText() === name
  );
}

function literalValue(property) {
  return property?.initializer && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : undefined;
}

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

      if (tag === "button") {
        const type = literalValue(attribute(node, "type"));
        const onClick = attribute(node, "onClick");
        let parent = node.parent;
        let inForm = false;
        while (parent) {
          if (
            ts.isJsxElement(parent) &&
            parent.openingElement.tagName.getText(sourceFile) === "form"
          ) {
            inForm = true;
            break;
          }
          parent = parent.parent;
        }
        if (!onClick && type !== "submit" && !(inForm && !type)) {
          findings.push(
            `${file}:${line} button has no click handler or submit behavior`
          );
        }
      }

      if (tag === "a") {
        const href = attribute(node, "href");
        if (!href) findings.push(`${file}:${line} anchor has no href`);
        if (literalValue(href) === "#") {
          findings.push(`${file}:${line} anchor points to #`);
        }
      }

      if (
        tag === "form" &&
        !attribute(node, "onSubmit") &&
        !attribute(node, "action")
      ) {
        findings.push(`${file}:${line} form has no submit handler or action`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

console.log(
  JSON.stringify(
    {
      files: files.length,
      controls: {
        buttons: files.reduce(
          (total, file) =>
            total +
            (fs.readFileSync(file, "utf8").match(/<button\b/g) ?? []).length,
          0
        ),
        links: files.reduce(
          (total, file) =>
            total + (fs.readFileSync(file, "utf8").match(/<a\b/g) ?? []).length,
          0
        ),
        forms: files.reduce(
          (total, file) =>
            total +
            (fs.readFileSync(file, "utf8").match(/<form\b/g) ?? []).length,
          0
        )
      },
      findings
    },
    null,
    2
  )
);
