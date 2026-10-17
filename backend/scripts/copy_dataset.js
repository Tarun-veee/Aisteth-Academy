import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidates = [
  path.resolve(__dirname, '../../src/data/all_topics_questions.json'),
  path.resolve(process.cwd(), 'src/data/all_topics_questions.json'),
  path.resolve(process.cwd(), '../src/data/all_topics_questions.json'),
];

let sourcePath = null;
for (const cand of candidates) {
  if (fs.existsSync(cand)) {
    sourcePath = cand;
    break;
  }
}

if (!sourcePath) {
  console.error('[build] Fatal: Authoritative dataset not found at src/data/all_topics_questions.json');
  process.exit(1);
}

// Validate dataset readability and integrity before packaging
let rawContent;
try {
  rawContent = fs.readFileSync(sourcePath, 'utf-8');
} catch (err) {
  console.error(`[build] Fatal: Failed to read authoritative dataset at '${sourcePath}': ${err.message}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(rawContent);
} catch (err) {
  console.error(`[build] Fatal: Authoritative dataset at '${sourcePath}' contains malformed JSON: ${err.message}`);
  process.exit(1);
}

const questions = Array.isArray(parsed) ? parsed : parsed.questions;
if (!questions || questions.length === 0) {
  console.error(`[build] Fatal: Authoritative dataset contains 0 questions.`);
  process.exit(1);
}

const targetDir = path.resolve(__dirname, '../dist/data');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}
const targetPath = path.join(targetDir, 'all_topics_questions.json');
fs.copyFileSync(sourcePath, targetPath);

// Independent verification of packaged production artifact
if (!fs.existsSync(targetPath)) {
  console.error(`[build] Fatal: Packaging failed, production artifact not found at '${targetPath}'.`);
  process.exit(1);
}

const targetStats = fs.statSync(targetPath);
const sourceStats = fs.statSync(sourcePath);
if (targetStats.size !== sourceStats.size || targetStats.size === 0) {
  console.error(`[build] Fatal: Packaged artifact size (${targetStats.size}) does not match source (${sourceStats.size}).`);
  process.exit(1);
}

console.log(`[build] Verified and packaged dataset into production artifact: ${targetPath} (${questions.length} questions, ${targetStats.size} bytes)`);
