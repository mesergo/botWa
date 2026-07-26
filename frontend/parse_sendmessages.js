const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'components', 'SendMessagesPage.tsx');
const src = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const diagnostics = sf.parseDiagnostics.map(d => ({ line: d.start !== undefined ? sf.getLineAndCharacterOfPosition(d.start).line + 1 : null, col: d.start !== undefined ? sf.getLineAndCharacterOfPosition(d.start).character + 1 : null, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
console.log(JSON.stringify(diagnostics, null, 2));
