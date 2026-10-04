# AiSteth Academy — Questionnaire Content Audit & Schema Specification

**Document Version:** `2.0.0-AUDIT`  
**Target Dataset:** `AI_limitation.json`  
**Audit Date:** 2026-09-30  
**Status:** Complete & Approved for Transformation Pipeline  

---

## 1. Executive Summary & Curriculum Scope

`AI_limitation.json` is the **authoritative product questionnaire dataset** for AiSteth Academy Module 1 (AI Limitation & Clinical Decision Making). It contains real clinical training questions designed for frontline health workers (ASHA / RBSK teams) operating the AiSteth digital stethoscope.

> [!IMPORTANT]
> **Scope Invariant**: The current `AI_limitation.json` file represents a **20-question content release for the AI Limitation module**. It does not by itself establish the total platform-wide questionnaire size. Future curriculum modules (e.g. Device Handling, Anatomical Placement, Stethoscope Sound Discrimination) may be introduced through subsequent versioned immutable content releases.
>
> `AI_limitation.json` is **real clinical curriculum content**, NOT dummy or placeholder data. The raw file must remain untouched in source control. All schema alignment, field normalization, and UI enrichment are performed strictly via an automated ingestion pipeline.

---

## 2. Comprehensive 25-Point Content Audit

### A. Exact Filename and Path
- **Workspace Path:** `c:\Users\ASUS\Downloads\work\acad\AI_limitation.json`
- **File Size:** 18,268 bytes (344 lines)
- **Encoding:** UTF-8 JSON

### B. Exact Question Count
- **Total Questions:** **20 records**
- **Primary Questions (`-TH`):** 10 records (`MG-AIL-01-TH` to `MG-AIL-10-TH`)
- **Follow-Up Questions (`-PR`):** 10 records (`MG-AIL-01-PR` to `MG-AIL-10-PR`)
- **Parent-Child Linkages:** Every `-PR` question links directly to its corresponding `-TH` parent via `Follow_Up_For`.

### C. JSON Structure
```json
{
  "questions": [
    {
      "Question_ID": "MG-AIL-01-TH",
      "Topic": "AI limitation",
      "Question_Type": "Primary",
      "Difficulty_Rank": 1,
      "Follow_Up_For": null,
      "Audience": "RBSK",
      "Question": "AiSteth says 'no murmur', but the child has cyanosis (blue lips) and poor growth. What should guide action?",
      "Option_A": "Refer the child to a doctor.",
      "Option_B": "Believe AiSteth only.",
      "Option_C": "Tell the family everything is normal.",
      "Option_D": "Ignore the child's signs.",
      "Correct": "A",
      "Explanation": "AiSteth is a helpful tool, but it such important signs in the child should not be ignored. Blue lips and poor growth need a doctor's check.",
      "Action": "Refer the child to a doctor.",
      "MedGemma_Tag": "module1::ai_limitation::applied"
    }
  ]
}
```

### D. Every Field Present
1. `Question_ID` (string)
2. `Topic` (string)
3. `Question_Type` (string)
4. `Difficulty_Rank` (number / integer)
5. `Follow_Up_For` (string or null)
6. `Audience` (string)
7. `Question` (string)
8. `Option_A` (string)
9. `Option_B` (string)
10. `Option_C` (string)
11. `Option_D` (string)
12. `Correct` (string: "A" | "B" | "C" | "D")
13. `Explanation` (string)
14. `Action` (string)
15. `MedGemma_Tag` (string)

### E. Data Types
| Field | Raw JSON Type | Nullable | Example Value |
| :--- | :--- | :---: | :--- |
| `Question_ID` | `string` | No | `"MG-AIL-01-TH"` |
| `Topic` | `string` | No | `"AI limitation"` |
| `Question_Type` | `string` | No | `"Primary"` / `"Follow-Up"` |
| `Difficulty_Rank` | `number` | No | `1` to `10` |
| `Follow_Up_For` | `string` \| `null` | Yes | `"MG-AIL-01-TH"` / `null` |
| `Audience` | `string` | No | `"RBSK"` |
| `Question` | `string` | No | Clinical scenario prompt |
| `Option_A` to `Option_D` | `string` | No | Multiple choice option text |
| `Correct` | `string` | No | `"A"`, `"B"`, `"C"`, or `"D"` |
| `Explanation` | `string` | No | Clinical rationale string |
| `Action` | `string` | No | `"Refer the child to a doctor."` |
| `MedGemma_Tag` | `string` | No | `"module1::ai_limitation::applied"` |

### F. Question Type Distribution
- **Single Choice Multiple Choice (MCQ)**: 20 / 20 (100%)
- **True / False**: 0 / 20
- **Image Tap / Hotspot**: 0 / 20
- **Step Order**: 0 / 20
- **Audio Discrimination**: 0 / 20

> [!NOTE]
> **Renderer Capability vs Content Release Distribution**: The AiSteth Academy client application engine supports five distinct question renderer types (`MCQ`, `TRUE_FALSE`, `IMAGE_TAP`, `STEP_ORDER`, `AUDIO_DISCRIMINATION`). This is an **application rendering capability**, not a constraint that every content release must contain all five types. The current `AI_limitation.json` release contains 100% MCQs, and the session generator is designed to handle this content-driven reality cleanly.

### G. Topic Distribution
- **AI limitation**: 20 / 20 (100%)

### H. Competency / Category Distribution
- **Quality Assessment & Clinical Decision Making**: 20 / 20 (Clinical override of AI stethoscope findings when physical danger signs like cyanosis or failure to thrive are observed).

### I. Correct-Answer Representation
- Stored as uppercase character code: `"A"`, `"B"`, `"C"`, or `"D"`.
- Correct option index distribution across the 20 questions:
  - Option A: 5 questions (`MG-AIL-01-TH`, `MG-AIL-02-PR`, `MG-AIL-05-TH`, `MG-AIL-05-PR`, `MG-AIL-08-TH`)
  - Option B: 3 questions (`MG-AIL-03-PR`, `MG-AIL-06-TH`, `MG-AIL-08-PR`)
  - Option C: 7 questions (`MG-AIL-03-TH`, `MG-AIL-06-PR`, `MG-AIL-07-TH`, `MG-AIL-07-PR`, `MG-AIL-09-TH`, `MG-AIL-10-TH`, `MG-AIL-10-PR`)
  - Option D: 5 questions (`MG-AIL-01-PR`, `MG-AIL-02-TH`, `MG-AIL-04-TH`, `MG-AIL-04-PR`, `MG-AIL-09-PR`)

### J. Explanation Fields
- Present in all 20 questions.
- Content: `"AiSteth is a helpful tool, but it such important signs in the child should not be ignored. Blue lips and poor growth need a doctor's check."` (Contains raw text typo "it such important signs" — documented for transformation pipeline).

### K. Action Fields
- Present in all 20 questions.
- Value: `"Refer the child to a doctor."` (Protocol-driven action advice).

### L. Difficulty Fields
- Present as `Difficulty_Rank` integer from `1` to `10`.
- Maps directly to 10 progressive paired tiers (Rank 1 = `MG-AIL-01-*` through Rank 10 = `MG-AIL-10-*`).

### M. Audience Fields
- Value: `"RBSK"` (Rashtriya Bal Swasthya Karyakram — National Child Health Program frontline screening teams).

### N. Media References
- **No external media assets** (audio clips or diagrams) are referenced in `AI_limitation.json`. All 20 items are text-based scenario MCQs.

### O. MedGemma-Related Metadata
- `MedGemma_Tag`: `"module1::ai_limitation::applied"` on all records.

### P. Follow_Up_For Relationships
- 10 Primary questions (`-TH`) have `Follow_Up_For: null`.
- 10 Follow-Up questions (`-PR`) specify the exact parent ID in `Follow_Up_For`:
  - `MG-AIL-01-PR` $\rightarrow$ `MG-AIL-01-TH`
  - `MG-AIL-02-PR` $\rightarrow$ `MG-AIL-02-TH`
  - ...
  - `MG-AIL-10-PR` $\rightarrow$ `MG-AIL-10-TH`

### Q. Missing Canonical Backend Fields
When mapping `AI_limitation.json` to the backend question schema, the following canonical fields are derived during ingestion:
1. `learningObjective` (derived from Topic + Action)
2. `category` (mapped to `'QUALITY_ASSESSMENT'`)
3. `type` (mapped to `'MCQ'`)
4. `difficulty` (mapped from `Difficulty_Rank`: 1–3 $\rightarrow$ `'BEGINNER'`, 4–7 $\rightarrow$ `'INTERMEDIATE'`, 8–10 $\rightarrow$ `'ADVANCED'`)
5. `tags` (array derived from `Topic`, `Audience`, `MedGemma_Tag`)
6. `clinicianValidated` (boolean: `true`)
7. `version` (string: `'1.0.0'`)
8. `contentReleaseId` (string: `'rel_v1_0_0'`)
9. `correctAnswer` (mapped from `"A"` $\rightarrow$ `'option_a'`, etc.)

### R. Extra Fields
All MedGemma curriculum metadata (`Question_Type`, `Difficulty_Rank`, `Follow_Up_For`, `Audience`, `Action`, `MedGemma_Tag`) is preserved under a dedicated `medGemmaMetadata` sub-map in the Firestore document.

### S. Duplicate IDs
- **Zero duplicates**. All 20 `Question_ID` strings are unique.

### T. Malformed / Inconsistent Records
- **Zero schema violations**. All 20 records strictly follow identical structure.

### U. Required Normalization
- Option keys normalized to `option_a`, `option_b`, `option_c`, `option_d`.
- Correct answer letter `"A"` normalized to canonical option key `'option_a'`.

### V. Required Transformation Pipeline
An automated ingestion script transforms raw `AI_limitation.json` into canonical Firestore question documents without altering the source file.

### W. Content-Release Ingestion Requirements
- Ingested under release ID: `rel_v1_0_0`
- Document path: `/contentReleases/rel_v1_0_0/questions/{questionId}`
- Status: `PUBLISHED`
- Release metadata:
  - `releaseId`: `"rel_v1_0_0"`
  - `version`: `"1.0.0"`
  - `totalQuestions`: 20
  - `name`: `"Module 1: AI Limitation & Clinical Decision Making"`
  - `status`: `"PUBLISHED"`

### X. Phase 3 Relevant Metadata & Session Selection Policy
- **Phase 2 Invariant**: Store both `-TH` and `-PR` questions in the release. Daily sessions select 10 questions from the 20-question active pool based on curriculum configuration (e.g. difficulty distribution, non-repetition).
- **Phase 3 Invariant**: Dynamic adaptive triggering of `Follow_Up_For` relationships (presenting `MG-AIL-XX-PR` dynamically when a learner misses `MG-AIL-XX-TH`) is **strictly deferred to Phase 3**.

### Y. Final Content Readiness Status
**CONTENT STATUS: 100% READY FOR INGESTION PIPELINE (PHASE 2.6)**
