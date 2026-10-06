/**
 * AiSteth Academy — Question Bank Schema Validation Utility
 *
 * Purpose: Validates question datasets against the formal question.schema.json using Ajv.
 * Input:   src/data/dummy_questions.json, question.schema.json
 * Output:  CLI status message (Exit 0 on validation pass, Exit 1 with error report on failure)
 * Usage:   npm run validate:schema  (or: node scripts/validate_schema.js)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.resolve(__dirname, '../question.schema.json');
const dataPath = path.resolve(__dirname, '../src/data/dummy_questions.json');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const valid = validate(data);

if (valid) {
  console.log(`✅ SUCCESS: dummy_questions.json strictly conforms to question.schema.json! (${data.length} questions validated)`);
  process.exit(0);
} else {
  console.error('❌ VALIDATION FAILED:');
  console.error(validate.errors);
  process.exit(1);
}
