import React from 'react';
import {
  Question,
  UserAnswerPayload,
  AnswerEvaluationResult,
  MCQQuestion,
  TrueFalseQuestion,
  ImageTapQuestion,
  StepOrderQuestion,
  AudioDiscriminationQuestion
} from '../../models/question.types';
import { MCQRenderer, OptionKey } from './MCQRenderer';
import { TrueFalseRenderer } from './TrueFalseRenderer';
import { ImageTapRenderer } from './ImageTapRenderer';
import { StepOrderRenderer } from './StepOrderRenderer';
import { AudioDiscriminationRenderer } from './AudioDiscriminationRenderer';

export interface QuestionRendererProps {
  question: Question;
  currentAnswer: UserAnswerPayload | null;
  onAnswerChange: (answer: UserAnswerPayload) => void;
  evaluation: AnswerEvaluationResult | null;
  isSubmitted: boolean;
  eliminatedOptions?: OptionKey[];
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  evaluation,
  isSubmitted,
  eliminatedOptions = [],
}) => {
  switch (question?.type) {
    case 'MCQ':
      return (
        <MCQRenderer
          question={question as MCQQuestion}
          currentAnswer={currentAnswer}
          onAnswerChange={onAnswerChange}
          evaluation={evaluation}
          isSubmitted={isSubmitted}
          eliminatedOptions={eliminatedOptions}
        />
      );
    case 'TRUE_FALSE':
      return (
        <TrueFalseRenderer
          question={question as TrueFalseQuestion}
          currentAnswer={currentAnswer}
          onAnswerChange={onAnswerChange}
          evaluation={evaluation}
          isSubmitted={isSubmitted}
        />
      );
    case 'IMAGE_TAP':
      return (
        <ImageTapRenderer
          question={question as ImageTapQuestion}
          currentAnswer={currentAnswer}
          onAnswerChange={onAnswerChange}
          evaluation={evaluation}
          isSubmitted={isSubmitted}
        />
      );
    case 'STEP_ORDER':
      return (
        <StepOrderRenderer
          question={question as StepOrderQuestion}
          currentAnswer={currentAnswer}
          onAnswerChange={onAnswerChange}
          evaluation={evaluation}
          isSubmitted={isSubmitted}
        />
      );
    case 'AUDIO_DISCRIMINATION':
      return (
        <AudioDiscriminationRenderer
          question={question as AudioDiscriminationQuestion}
          currentAnswer={currentAnswer}
          onAnswerChange={onAnswerChange}
          evaluation={evaluation}
          isSubmitted={isSubmitted}
        />
      );
    default:
      return (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm">
          Unsupported question type.
        </div>
      );
  }
};
