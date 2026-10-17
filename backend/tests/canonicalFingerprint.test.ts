import { describe, it, expect } from 'vitest';
import {
  canonicalizePayloadV2,
  computeCanonicalPayloadFingerprintV2,
  computeCanonicalPayloadFingerprint,
  BadRequestError,
} from '../src/domain/rules/sessionValidation.js';

describe('Phase 2: Canonical Payload Fingerprinting V2 Suite', () => {
  describe('Recursive Object-Key Sorting & Invariants', () => {
    it('FP-01: sorts root keys lexicographically in UTF-16 code unit order', () => {
      const objA = { b: 1, a: 2, c: 3 };
      const objB = { c: 3, a: 2, b: 1 };
      expect(canonicalizePayloadV2(objA)).toBe('{"a":2,"b":1,"c":3}');
      expect(canonicalizePayloadV2(objB)).toBe('{"a":2,"b":1,"c":3}');
      expect(computeCanonicalPayloadFingerprintV2(objA)).toBe(computeCanonicalPayloadFingerprintV2(objB));
    });

    it('FP-02: sorts nested object keys recursively at arbitrary depth', () => {
      const nestedA = { outer: { z: 1, y: 2, x: { beta: 'b', alpha: 'a' } } };
      const nestedB = { outer: { x: { alpha: 'a', beta: 'b' }, y: 2, z: 1 } };
      expect(canonicalizePayloadV2(nestedA)).toBe('{"outer":{"x":{"alpha":"a","beta":"b"},"y":2,"z":1}}');
      expect(computeCanonicalPayloadFingerprintV2(nestedA)).toBe(computeCanonicalPayloadFingerprintV2(nestedB));
    });

    it('FP-03: preserves array order strictly (distinct sequence = distinct hash)', () => {
      const stepOrder1 = { type: 'STEP_ORDER', ordered_step_ids: ['step_1', 'step_2', 'step_3'] };
      const stepOrder2 = { type: 'STEP_ORDER', ordered_step_ids: ['step_2', 'step_1', 'step_3'] };
      expect(canonicalizePayloadV2(stepOrder1)).not.toBe(canonicalizePayloadV2(stepOrder2));
      expect(computeCanonicalPayloadFingerprintV2(stepOrder1)).not.toBe(computeCanonicalPayloadFingerprintV2(stepOrder2));
    });

    it('FP-04: differentiates nested coordinates (resolving V1 key-stripping defect)', () => {
      const coordA = { type: 'IMAGE_TAP', tap_coordinate: { x_percent: 24.5, y_percent: 60.1 } };
      const coordB = { type: 'IMAGE_TAP', tap_coordinate: { x_percent: 24.5, y_percent: 60.2 } };
      
      // In V1, both produced identical stripped string '{"tap_coordinate":{},"type":"IMAGE_TAP"}'
      expect(computeCanonicalPayloadFingerprint(coordA)).toBe(computeCanonicalPayloadFingerprint(coordB));

      // In V2, both produce distinct canonical strings and hashes
      expect(canonicalizePayloadV2(coordA)).toBe('{"tap_coordinate":{"x_percent":24.5,"y_percent":60.1},"type":"IMAGE_TAP"}');
      expect(canonicalizePayloadV2(coordB)).toBe('{"tap_coordinate":{"x_percent":24.5,"y_percent":60.2},"type":"IMAGE_TAP"}');
      expect(computeCanonicalPayloadFingerprintV2(coordA)).not.toBe(computeCanonicalPayloadFingerprintV2(coordB));
    });
  });

  describe('Primitive Types and Numeric Normalization', () => {
    it('FP-05: normalizes negative zero (-0) to positive zero ("0")', () => {
      const zeroPos = { val: 0 };
      const zeroNeg = { val: -0 };
      expect(canonicalizePayloadV2(zeroPos)).toBe('{"val":0}');
      expect(canonicalizePayloadV2(zeroNeg)).toBe('{"val":0}');
      expect(computeCanonicalPayloadFingerprintV2(zeroPos)).toBe(computeCanonicalPayloadFingerprintV2(zeroNeg));
    });

    it('FP-06: serializes booleans, null, strings, and standard finite floats deterministically', () => {
      const payload = {
        boolTrue: true,
        boolFalse: false,
        nullVal: null,
        strVal: 'AiSteth "Specialist"',
        floatVal: 98.6,
      };
      const serialized = canonicalizePayloadV2(payload);
      expect(serialized).toBe('{"boolFalse":false,"boolTrue":true,"floatVal":98.6,"nullVal":null,"strVal":"AiSteth \\"Specialist\\""}');
    });

    it('FP-07: rejects non-finite numbers (NaN, Infinity, -Infinity) with BadRequestError', () => {
      expect(() => canonicalizePayloadV2({ val: NaN })).toThrow(BadRequestError);
      expect(() => canonicalizePayloadV2({ val: Infinity })).toThrow(BadRequestError);
      expect(() => canonicalizePayloadV2({ val: -Infinity })).toThrow(BadRequestError);
    });
  });

  describe('Undefined, Dates, and Unsupported Types', () => {
    it('FP-08: omits undefined object properties but preserves undefined in arrays as null', () => {
      const withUndefinedProp = { a: 1, b: undefined, c: 3 };
      expect(canonicalizePayloadV2(withUndefinedProp)).toBe('{"a":1,"c":3}');

      const withUndefinedArrayItem = { arr: [1, undefined, 3] };
      expect(canonicalizePayloadV2(withUndefinedArrayItem)).toBe('{"arr":[1,null,3]}');
    });

    it('FP-09: rejects top-level undefined payload', () => {
      expect(() => canonicalizePayloadV2(undefined)).toThrow(BadRequestError);
    });

    it('FP-10: serializes valid Dates to ISO 8601 strings and rejects invalid Dates', () => {
      const validDate = new Date('2026-10-15T12:00:00.000Z');
      expect(canonicalizePayloadV2({ timestamp: validDate })).toBe('{"timestamp":"2026-10-15T12:00:00.000Z"}');

      const invalidDate = new Date('invalid');
      expect(() => canonicalizePayloadV2({ timestamp: invalidDate })).toThrow(BadRequestError);
    });

    it('FP-11: rejects functions, symbols, and BigInt with BadRequestError', () => {
      expect(() => canonicalizePayloadV2({ fn: () => {} })).toThrow(BadRequestError);
      expect(() => canonicalizePayloadV2({ sym: Symbol('sym') })).toThrow(BadRequestError);
      expect(() => canonicalizePayloadV2({ big: BigInt(123) })).toThrow(BadRequestError);
    });

    it('FP-12: rejects unsupported object structures (Map, Set, RegExp)', () => {
      expect(() => canonicalizePayloadV2({ map: new Map() })).toThrow(BadRequestError);
      expect(() => canonicalizePayloadV2({ set: new Set() })).toThrow(BadRequestError);
      expect(() => canonicalizePayloadV2({ regex: /test/g })).toThrow(BadRequestError);
    });
  });

  describe('Graph Cycles, Shared References (DAG), and Resource Limits', () => {
    it('FP-13: rejects true circular references with CIRCULAR_PAYLOAD_DETECTED', () => {
      const circularObj: any = { a: 1 };
      circularObj.self = circularObj;
      expect(() => canonicalizePayloadV2(circularObj)).toThrow(BadRequestError);
      expect(() => canonicalizePayloadV2(circularObj)).toThrow(/CIRCULAR_PAYLOAD_DETECTED/);
    });

    it('FP-14: permits shared (diamond) references in acyclic graphs without false cycle errors', () => {
      const sharedNode = { sharedKey: 'sharedValue' };
      const diamondGraph = {
        branchA: sharedNode,
        branchB: sharedNode,
      };
      const serialized = canonicalizePayloadV2(diamondGraph);
      expect(serialized).toBe('{"branchA":{"sharedKey":"sharedValue"},"branchB":{"sharedKey":"sharedValue"}}');
    });

    it('FP-15: enforces nesting depth limit of 10 levels', () => {
      // Depth 10 should succeed
      let current: any = { leaf: 'val' };
      for (let i = 0; i < 9; i++) {
        current = { child: current };
      }
      expect(() => canonicalizePayloadV2(current)).not.toThrow();

      // Depth 11 should throw PAYLOAD_DEPTH_EXCEEDED
      current = { child: current };
      expect(() => canonicalizePayloadV2(current)).toThrow(/PAYLOAD_DEPTH_EXCEEDED/);
    });

    it('FP-16: enforces size limit of 64 KB', () => {
      const largeString = 'a'.repeat(66000);
      expect(() => canonicalizePayloadV2({ large: largeString })).toThrow(/PAYLOAD_SIZE_EXCEEDED/);
    });
  });

  describe('Historical V1 Fingerprint Compatibility', () => {
    it('FP-17: preserves exact V1 historical hashing behavior for string options and objects', () => {
      const mcqOption = 'option_b';
      const v1Hash = computeCanonicalPayloadFingerprint(mcqOption);
      expect(v1Hash).toHaveLength(64);

      // Verifies that V1 still reproduces the historical string hash
      const crypto = require('crypto');
      const expected = crypto.createHash('sha256').update('option_b').digest('hex');
      expect(v1Hash).toBe(expected);
    });
  });
});
