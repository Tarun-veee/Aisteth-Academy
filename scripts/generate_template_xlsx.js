/**
 * AiSteth Academy — Questionnaire Excel Template Generator
 *
 * Purpose: Generates the authoritative questions_template.xlsx spreadsheet with schema columns, styling, and authoring guidelines.
 * Input:   Internal schema definition (MCQ, True/False, Image Tap, Step Order, Audio Discrimination)
 * Output:  questions_template.xlsx in repository root
 * Usage:   npm run generate:xlsx  (or: node scripts/generate_template_xlsx.js)
 */
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AiSteth Academy';
  workbook.lastModifiedBy = 'AiSteth Content Pipeline';
  workbook.created = new Date();

  // 1. Template Sheet
  const sheet = workbook.addWorksheet('Questions_Template', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const headers = [
    { header: 'question_id', key: 'question_id', width: 18 },
    { header: 'category', key: 'category', width: 22 },
    { header: 'type', key: 'type', width: 20 },
    { header: 'difficulty', key: 'difficulty', width: 15 },
    { header: 'question', key: 'question', width: 40 },
    { header: 'option_a', key: 'option_a', width: 25 },
    { header: 'option_b', key: 'option_b', width: 25 },
    { header: 'option_c', key: 'option_c', width: 25 },
    { header: 'option_d', key: 'option_d', width: 25 },
    { header: 'correct_answer', key: 'correct_answer', width: 18 },
    { header: 'explanation', key: 'explanation', width: 45 },
    { header: 'learning_objective', key: 'learning_objective', width: 40 },
    { header: 'tags', key: 'tags', width: 25 },
    { header: 'image_asset', key: 'image_asset', width: 30 },
    { header: 'target_zone', key: 'target_zone', width: 25 },
    { header: 'tolerance_radius_percent', key: 'tolerance_radius_percent', width: 15 },
    { header: 'initial_steps', key: 'initial_steps', width: 40 },
    { header: 'correct_step_order', key: 'correct_step_order', width: 25 },
    { header: 'audio_asset_a', key: 'audio_asset_a', width: 30 },
    { header: 'audio_asset_b', key: 'audio_asset_b', width: 30 },
    { header: 'label_a', key: 'label_a', width: 15 },
    { header: 'label_b', key: 'label_b', width: 15 },
    { header: 'correct_audio', key: 'correct_audio', width: 15 },
    { header: 'clinical_finding', key: 'clinical_finding', width: 35 },
    { header: 'clinician_validated', key: 'clinician_validated', width: 18 },
    { header: 'source', key: 'source', width: 15 },
    { header: 'version', key: 'version', width: 12 }
  ];

  sheet.columns = headers;

  // Style Header Row (AiSteth Blue Theme)
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' } // Deep clinical blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Sample Rows covering all 5 types
  const sampleRows = [
    {
      question_id: 'DEMO_MCQ_001',
      category: 'DEVICE_HANDLING',
      type: 'MCQ',
      difficulty: 'BEGINNER',
      question: 'What should you check on the AiSteth device before placing it on a patient\'s chest?',
      option_a: 'Ensure device power is on and battery indicator is green',
      option_b: 'Check the patient\'s height and weight record',
      option_c: 'Ensure the room temperature is below 20°C',
      option_d: 'Check the mobile SIM card balance',
      correct_answer: 'option_a',
      explanation: 'Always confirm the AiSteth device is powered on and has sufficient battery before beginning an auscultation recording.',
      learning_objective: 'Verify device readiness and power status prior to clinical procedure.',
      tags: 'device_check; battery; pre_recording',
      image_asset: '',
      target_zone: '',
      tolerance_radius_percent: '',
      initial_steps: '',
      correct_step_order: '',
      audio_asset_a: '',
      audio_asset_b: '',
      label_a: '',
      label_b: '',
      correct_audio: '',
      clinical_finding: '',
      clinician_validated: 'FALSE',
      source: 'DEMO',
      version: '1.0.0'
    },
    {
      question_id: 'DEMO_TF_001',
      category: 'OPERATING_PROCEDURE',
      type: 'TRUE_FALSE',
      difficulty: 'BEGINNER',
      question: 'The AiSteth diaphragm should be pressed firmly enough on bare skin to leave a deep indentation.',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'FALSE',
      explanation: 'Firm, steady contact with bare skin is required, but excessive pressure causes discomfort and introduces muscle tremor noise.',
      learning_objective: 'Apply correct contact pressure without causing patient discomfort or artifact noise.',
      tags: 'skin_contact; pressure; recording_quality',
      image_asset: '',
      target_zone: '',
      tolerance_radius_percent: '',
      initial_steps: '',
      correct_step_order: '',
      audio_asset_a: '',
      audio_asset_b: '',
      label_a: '',
      label_b: '',
      correct_audio: '',
      clinical_finding: '',
      clinician_validated: 'FALSE',
      source: 'DEMO',
      version: '1.0.0'
    },
    {
      question_id: 'DEMO_IMG_001',
      category: 'ANATOMICAL_PLACEMENT',
      type: 'IMAGE_TAP',
      difficulty: 'INTERMEDIATE',
      question: 'Tap the Mitral (Apex) auscultation area on the patient\'s chest diagram.',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: '',
      explanation: 'The Mitral area is located at the 5th intercostal space along the left midclavicular line (apex of the heart).',
      learning_objective: 'Accurately locate the Mitral auscultation landmark.',
      tags: 'anatomy; mitral_area; placement',
      image_asset: '/assets/images/chest_auscultation_points.svg',
      target_zone: '58.0,62.0,74.0,78.0',
      tolerance_radius_percent: 6.0,
      initial_steps: '',
      correct_step_order: '',
      audio_asset_a: '',
      audio_asset_b: '',
      label_a: '',
      label_b: '',
      correct_audio: '',
      clinical_finding: '',
      clinician_validated: 'FALSE',
      source: 'DEMO',
      version: '1.0.0'
    },
    {
      question_id: 'DEMO_STEP_001',
      category: 'OPERATING_PROCEDURE',
      type: 'STEP_ORDER',
      difficulty: 'INTERMEDIATE',
      question: 'Arrange the steps for recording a heart sound in the correct sequence:',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: '',
      explanation: 'Standard procedure: Patient prep & quiet environment -> Clean device -> Place diaphragm steadily -> Start recording.',
      learning_objective: 'Master standard clinical operating sequence for digital stethoscope recordings.',
      tags: 'workflow; sop; recording',
      image_asset: '',
      target_zone: '',
      tolerance_radius_percent: '',
      initial_steps: 'step_3: Place diaphragm steadily | step_1: Prepare patient & quiet room | step_4: Tap Start Recording (15s) | step_2: Clean diaphragm with wipe',
      correct_step_order: 'step_1,step_2,step_3,step_4',
      audio_asset_a: '',
      audio_asset_b: '',
      label_a: '',
      label_b: '',
      correct_audio: '',
      clinical_finding: '',
      clinician_validated: 'FALSE',
      source: 'DEMO',
      version: '1.0.0'
    },
    {
      question_id: 'DEMO_AUD_001',
      category: 'QUALITY_ASSESSMENT',
      type: 'AUDIO_DISCRIMINATION',
      difficulty: 'ADVANCED',
      question: 'Listen to both recordings. Which recording is clear and suitable for diagnostic analysis?',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: '',
      explanation: 'Recording 2 exhibits clear S1 and S2 heart sounds. Recording 1 contains severe friction noise from clothing contact.',
      learning_objective: 'Distinguish between high-quality diagnostic heart recordings and noisy/artifact-heavy clips.',
      tags: 'audio_quality; artifacts; s1_s2',
      image_asset: '',
      target_zone: '',
      tolerance_radius_percent: '',
      initial_steps: '',
      correct_step_order: '',
      audio_asset_a: '/assets/audio/demo_noisy_recording.mp3',
      audio_asset_b: '/assets/audio/demo_clear_normal_s1s2.mp3',
      label_a: 'Recording 1',
      label_b: 'Recording 2',
      correct_audio: 'audio_b',
      clinical_finding: 'Clear S1/S2 heart sound with high signal-to-noise ratio.',
      clinician_validated: 'FALSE',
      source: 'DEMO',
      version: '1.0.0'
    }
  ];

  sampleRows.forEach((r, idx) => {
    const row = sheet.addRow(r);
    row.height = 24;
    row.alignment = { vertical: 'middle' };
    if (idx % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      };
    }
  });

  // 2. Reference Sheet
  const refSheet = workbook.addWorksheet('Schema_Reference');
  refSheet.columns = [
    { header: 'Field Name', key: 'field', width: 25 },
    { header: 'Applies To', key: 'applies_to', width: 25 },
    { header: 'Required?', key: 'required', width: 15 },
    { header: 'Format / Allowed Values', key: 'format', width: 40 },
    { header: 'Description', key: 'desc', width: 50 }
  ];

  const refHeader = refSheet.getRow(1);
  refHeader.height = 26;
  refHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  refHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

  const refData = [
    { field: 'question_id', applies_to: 'ALL', required: 'YES', format: 'Alphanumeric + Underscore (e.g. DH_MCQ_001)', desc: 'Unique question identifier' },
    { field: 'category', applies_to: 'ALL', required: 'YES', format: 'DEVICE_HANDLING, HEART_RECORDING, QUALITY_ASSESSMENT, OPERATING_PROCEDURE, ANATOMICAL_PLACEMENT', desc: 'Clinical learning module' },
    { field: 'type', applies_to: 'ALL', required: 'YES', format: 'MCQ, TRUE_FALSE, IMAGE_TAP, STEP_ORDER, AUDIO_DISCRIMINATION', desc: 'Question interaction format' },
    { field: 'difficulty', applies_to: 'ALL', required: 'YES', format: 'BEGINNER, INTERMEDIATE, ADVANCED', desc: 'Question difficulty level' },
    { field: 'question', applies_to: 'ALL', required: 'YES', format: 'Text (min 5 chars)', desc: 'Question prompt shown to trainee' },
    { field: 'option_a / b / c / d', applies_to: 'MCQ', required: 'YES (for MCQ)', format: 'Text', desc: 'Choices for Multiple Choice Questions' },
    { field: 'correct_answer', applies_to: 'MCQ, TRUE_FALSE', required: 'YES (for MCQ/TF)', format: 'option_a..option_d OR TRUE / FALSE', desc: 'Solution key' },
    { field: 'explanation', applies_to: 'ALL', required: 'YES', format: 'Text', desc: 'Micro-learning explanation shown after submission' },
    { field: 'learning_objective', applies_to: 'ALL', required: 'YES', format: 'Text', desc: 'Clinical competency objective' },
    { field: 'image_asset', applies_to: 'IMAGE_TAP', required: 'YES (for IMAGE_TAP)', format: 'File path / URL (SVG / PNG)', desc: 'Anatomical diagram or device image' },
    { field: 'target_zone', applies_to: 'IMAGE_TAP', required: 'YES (for IMAGE_TAP)', format: 'x_min,y_min,x_max,y_max in % (0-100)', desc: 'Valid hitbox bounding box' },
    { field: 'initial_steps', applies_to: 'STEP_ORDER', required: 'YES (for STEP_ORDER)', format: 'id: text | id: text (pipe-delimited)', desc: 'Scrambled steps for user to order' },
    { field: 'correct_step_order', applies_to: 'STEP_ORDER', required: 'YES (for STEP_ORDER)', format: 'step_1,step_2,... (comma-delimited IDs)', desc: 'Exact correct step sequence' },
    { field: 'audio_asset_a / b', applies_to: 'AUDIO_DISCRIMINATION', required: 'YES (for AUDIO_DISCRIMINATION)', format: 'File path / URL (MP3/WAV)', desc: 'A/B audio recordings to compare' },
    { field: 'correct_audio', applies_to: 'AUDIO_DISCRIMINATION', required: 'YES (for AUDIO_DISCRIMINATION)', format: 'audio_a OR audio_b', desc: 'Correct audio clip selection' },
    { field: 'clinical_finding', applies_to: 'AUDIO_DISCRIMINATION', required: 'YES (for AUDIO_DISCRIMINATION)', format: 'Text', desc: 'Acoustic clinical explanation' }
  ];

  refData.forEach(r => refSheet.addRow(r));

  const outputPath = path.resolve(__dirname, '../questions_template.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Successfully generated ${outputPath}`);
}

generateTemplate().catch(err => {
  console.error('Error generating template:', err);
  process.exit(1);
});
