import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationDir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();
const violations = [];

for (const file of files) {
  const source = fs.readFileSync(path.join(migrationDir, file), 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\bam\.status\b/i.test(line)) {
      violations.push(`${file}:${index + 1}: agency_members uses is_active, not status`);
    }
  });
}

const required = [
  ['agency_members', 'is_active'],
  ['mission_reports', 'status'],
  ['mission_reports', 'snapshot'],
];
const fullSource = files.map((file) => fs.readFileSync(path.join(migrationDir, file), 'utf8')).join('\n');
for (const [table, column] of required) {
  if (!new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+public\\.${table}[\\s\\S]*?\\b${column}\\b`, 'i').test(fullSource)) {
    violations.push(`Missing declared contract: public.${table}.${column}`);
  }
}

if (violations.length) {
  console.error('Schema Contract Engine failed:\n' + violations.map((v) => `- ${v}`).join('\n'));
  process.exit(1);
}
console.log(`Schema Contract Engine passed across ${files.length} migrations.`);
