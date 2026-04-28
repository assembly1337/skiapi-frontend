import { readFileSync } from 'node:fs';

const aiAssistant = readFileSync('src/components/common/AiAssistant.jsx', 'utf8');
const aiTools = readFileSync('src/components/common/aiTools.js', 'utf8');

const failures = [];

function requireMatch(name, text, pattern) {
  if (!pattern.test(text)) failures.push(name);
}

function rejectMatch(name, text, pattern) {
  if (pattern.test(text)) failures.push(name);
}

requireMatch(
  'tool result must be sanitized before returning to LLM',
  aiAssistant,
  /JSON\.stringify\(\s*sanitizeToolResultForLLM\(result\)\s*\)/
);
rejectMatch(
  'raw tool result must not be stringified into role=tool content',
  aiAssistant,
  /content:\s*JSON\.stringify\(result\)/
);
requireMatch(
  'mutating tools must pass through a local confirmation helper',
  aiAssistant,
  /getToolConfirmation\(fnName,\s*args\)/
);
requireMatch(
  'assistant fetch must include New-Api-User compatibility header',
  aiAssistant,
  /getNewApiUserHeader\(\)/
);
requireMatch(
  'assistant markdown links must use shared URL safety helper',
  aiAssistant,
  /isSafeUrl\(href\)/
);

for (const toolName of ['create_token', 'delete_token', 'redeem_code']) {
  requireMatch(
    `${toolName} must be represented in confirmation switch`,
    aiTools,
    new RegExp(`case ['"]${toolName}['"]`)
  );
}

rejectMatch(
  'create_token must not return a public enumerable raw key field',
  aiTools,
  /return\s*\{[\s\S]{0,240}\bkey\s*,[\s\S]{0,240}\}/
);
rejectMatch(
  'create_token message must not include raw key text',
  aiTools,
  /Token created!\s*Key:/
);
requireMatch(
  'local copy action should be non-enumerable so JSON.stringify cannot leak it',
  aiTools,
  /Object\.defineProperty\(\s*result,\s*['_"]_action['_"][\s\S]{0,160}enumerable:\s*false/
);

if (failures.length) {
  console.error('AI assistant security check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AI assistant security check passed');
