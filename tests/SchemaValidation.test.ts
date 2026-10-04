import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../question.schema.json';
import dummyQuestions from '../src/data/dummy_questions.json';

describe('Question Schema Compliance', () => {
  it('validates dummy_questions.json strictly against question.schema.json', () => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(dummyQuestions);

    if (!valid) {
      console.error(validate.errors);
    }

    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });
});
