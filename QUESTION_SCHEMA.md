# AiSteth Academy — Questionnaire Content Contract & Schema Specification

**Document Version:** 1.0.0  
**Target Tracks:** Track 1 (Frontend), Track 2 (Backend/Firebase), Track 3 (AIML / MedGemma Content Pipeline)  
**Schema File:** [`question.schema.json`](./question.schema.json)  
**Excel Template:** [`questions_template.xlsx`](./questions_template.xlsx)

---

## 1. Overview & Architectural Contract

To maintain clean separation between the frontend application, backend storage, and AI-assisted clinical content authoring (MedGemma + clinician validation), all training content is governed by a **standardized, type-aware questionnaire schema**.

The authoring workflow:
```
Clinical Knowledge & SOPs
          ↓
MedGemma Drafting & Clinician Validation
          ↓
Authoring in Excel (`questions_template.xlsx`)
          ↓
Validation against `question.schema.json`
          ↓
Exported Machine-Readable JSON (`questions.json`)
          ↓
`IQuestionRepository` ➔ React Application
```

---

## 2. Global / Base Fields (Required for All Question Types)

Every question record regardless of type **MUST** include the following standard metadata fields:

| Field Name | Type | Allowed Values / Format | Description |
| :--- | :--- | :--- | :--- |
| `question_id` | `string` | Regex: `^[A-Za-z0-9_-]+$` (e.g. `DH_MCQ_001`) | Unique alphanumeric identifier. |
| `category` | `string` | `DEVICE_HANDLING`, `HEART_RECORDING`, `QUALITY_ASSESSMENT`, `OPERATING_PROCEDURE`, `ANATOMICAL_PLACEMENT` | Main clinical training competency module. |
| `type` | `string` | `MCQ`, `TRUE_FALSE`, `IMAGE_TAP`, `STEP_ORDER`, `AUDIO_DISCRIMINATION` | Polymorphic interaction type. |
| `difficulty` | `string` | `BEGINNER`, `INTERMEDIATE`, `ADVANCED` | Content difficulty grading. |
| `question` | `string` | Free text (Min 5 chars) | Primary instructional prompt presented to the user. |
| `explanation` | `string` | Free text (Min 5 chars) | Micro-learning explanation displayed in the feedback drawer after answer submission. |
| `learning_objective` | `string` | Free text (Min 5 chars) | Specific clinical competency being evaluated. |
| `tags` | `array<string>` | Comma-separated strings in Excel | Semantic tags for filtering and spaced repetition categorization. |
| `clinician_validated`| `boolean` | `true`, `false` | Must be `true` only for clinically certified questions. (Always `false` for demo questions). |
| `source` | `string` | `DEMO`, `CLINICAL`, `MEDGEMMA` | Provenance of the question. |
| `version` | `string` | Semantic version string (e.g., `1.0.0`) | Content revision version. |

---

## 3. Question-Type Specific Fields

### 3.1. Multiple Choice Question (`MCQ`)
Evaluates discrete clinical knowledge and recognition.

* **Required Type-Specific Fields:**
  * `option_a` (`string`): Choice A text.
  * `option_b` (`string`): Choice B text.
  * `option_c` (`string`): Choice C text.
  * `option_d` (`string`): Choice D text.
  * `correct_answer` (`string`): Exactly one of `"option_a"`, `"option_b"`, `"option_c"`, or `"option_d"`.

---

### 3.2. True / False (`TRUE_FALSE`)
Evaluates binary clinical statements, safety checks, or common misconceptions.

* **Required Type-Specific Fields:**
  * `correct_answer` (`boolean`): `true` or `false`.

---

### 3.3. Anatomical Image Tap (`IMAGE_TAP`)
Evaluates anatomical landmark identification (e.g. Mitral, Aortic, Tricuspid, Pulmonic auscultation points).

* **Required Type-Specific Fields:**
  * `image_asset` (`string`): Relative or CDN path to image (e.g. `/assets/images/chest_diagram.svg`).
  * `target_zone` (`object`): Normalized bounding box in percentages ($0.0 - 100.0\%$):
    * `x_min_percent` (`number`): Left boundary percentage.
    * `y_min_percent` (`number`): Top boundary percentage.
    * `x_max_percent` (`number`): Right boundary percentage.
    * `y_max_percent` (`number`): Bottom boundary percentage.
    * `label` (`string`, optional): Name of anatomical region.
  * `tolerance_radius_percent` (`number`, optional): Radial tolerance buffer around target.

---

### 3.4. Procedural Step Order (`STEP_ORDER`)
Evaluates clinical sequencing (e.g., device sanitation $\rightarrow$ patient instruction $\rightarrow$ placement $\rightarrow$ recording).

* **Required Type-Specific Fields:**
  * `initial_steps` (`array<{ id: string, text: string }>`): Scrambled list of step items.
  * `correct_step_order` (`array<string>`): Ordered list of step `id`s representing the exact correct chronological sequence.

---

### 3.5. Audio Discrimination (`AUDIO_DISCRIMINATION`)
Evaluates recording quality assessment and sound clarity comparison.

* **Required Type-Specific Fields:**
  * `audio_asset_a` (`string`): Path to first audio recording clip.
  * `audio_asset_b` (`string`): Path to second audio recording clip.
  * `label_a` (`string`, optional): Label for track A (defaults to "Recording 1").
  * `label_b` (`string`, optional): Label for track B (defaults to "Recording 2").
  * `correct_audio` (`string`): Exactly `"audio_a"` or `"audio_b"`.
  * `clinical_finding` (`string`): Clinical description of acoustic findings.

---

## 4. Excel Authoring Format Mapping

When editing in `questions_template.xlsx`, complex fields are encoded as follows:
* `tags`: Semicolon or comma-separated values (e.g., `device_check; battery; hygiene`).
* `target_zone` (for Image Tap): Formatted as `x_min,y_min,x_max,y_max` (e.g., `58.0,62.0,74.0,78.0`).
* `initial_steps` (for Step Order): Formatted as newline or pipe-delimited items (e.g., `step_1: Explain procedure | step_2: Clean diaphragm | step_3: Place steadily | step_4: Start recording`).
* `correct_step_order`: Comma-delimited list of IDs (e.g., `step_1,step_2,step_3,step_4`).

---

## 5. Validation Rules & Non-Negotiables

1. **No Clinical Assumption in Frontend**: The frontend engine only reads validated JSON output.
2. **Offline-First Assets**: All asset paths (`image_asset`, `audio_asset_a`, etc.) must resolve locally in Phase 1 and via remote CDN with local caching in Phase 2.
3. **Immutability of Question ID**: Once published, a `question_id` must never change between versions to preserve user history.
