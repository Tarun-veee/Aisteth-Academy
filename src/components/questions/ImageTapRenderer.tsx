import React, { useRef } from 'react';
import { ImageTapQuestion, UserAnswerPayload, AnswerEvaluationResult } from '../../models/question.types';
import { MapPin, Target } from 'lucide-react';

export interface ImageTapRendererProps {
  question: ImageTapQuestion;
  currentAnswer: UserAnswerPayload | null;
  onAnswerChange: (answer: UserAnswerPayload) => void;
  evaluation: AnswerEvaluationResult | null;
  isSubmitted: boolean;
}

export const ImageTapRenderer: React.FC<ImageTapRendererProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  evaluation,
  isSubmitted,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const tapCoordinate =
    currentAnswer && currentAnswer.type === 'IMAGE_TAP'
      ? currentAnswer.tap_coordinate
      : null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSubmitted || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    // Clamp to 0..100
    const clampedX = Math.max(0, Math.min(100, Number(x.toFixed(1))));
    const clampedY = Math.max(0, Math.min(100, Number(y.toFixed(1))));

    onAnswerChange({
      type: 'IMAGE_TAP',
      tap_coordinate: { x_percent: clampedX, y_percent: clampedY },
    });
  };

  const { x_min_percent, y_min_percent, x_max_percent, y_max_percent, label } =
    question.target_zone;

  const targetBoxWidth = x_max_percent - x_min_percent;
  const targetBoxHeight = y_max_percent - y_min_percent;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Instruction Banner */}
      <div className="flex items-center justify-between px-3 py-2 bg-brand-50 rounded-xl border border-brand-100 text-xs font-semibold text-brand-800">
        <span className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-brand-600" />
          {tapCoordinate ? 'Location selected. Tap again to adjust.' : 'Tap on the diagram to place the sensor'}
        </span>
        {tapCoordinate && (
          <span className="font-mono text-brand-600">
            {tapCoordinate.x_percent}% , {tapCoordinate.y_percent}%
          </span>
        )}
      </div>

      {/* Interactive Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className={`relative w-full aspect-[4/3.5] max-h-[360px] bg-slate-50 rounded-2xl border-2 overflow-hidden select-none touch-none ${
          isSubmitted
            ? 'border-slate-200 cursor-default'
            : 'border-slate-300 hover:border-brand-500 cursor-crosshair active:border-brand-600'
        }`}
      >
        {/* Background Diagram */}
        <img
          src={question.image_asset}
          alt={question.question}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* User Tap Marker Pin */}
        {tapCoordinate && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-150 z-20"
            style={{
              left: `${tapCoordinate.x_percent}%`,
              top: `${tapCoordinate.y_percent}%`,
            }}
          >
            <div className="flex flex-col items-center">
              <div
                className={`p-1.5 rounded-full shadow-lg border-2 ${
                  isSubmitted
                    ? evaluation?.is_correct
                      ? 'bg-status-success text-white border-white animate-bounce'
                      : 'bg-status-error text-white border-white'
                    : 'bg-brand-600 text-white border-white'
                }`}
              >
                <MapPin className="w-5 h-5 fill-current" />
              </div>
              <div className="w-2.5 h-1 bg-black/20 rounded-full blur-[1px] -mt-0.5" />
            </div>
          </div>
        )}

        {/* Post-submission Target Zone Reveal */}
        {isSubmitted && (
          <div
            className={`absolute border-2 border-dashed rounded-xl pointer-events-none z-10 transition-all ${
              evaluation?.is_correct
                ? 'border-status-success bg-status-successBg/40'
                : 'border-brand-600 bg-brand-50/50'
            }`}
            style={{
              left: `${x_min_percent}%`,
              top: `${y_min_percent}%`,
              width: `${targetBoxWidth}%`,
              height: `${targetBoxHeight}%`,
            }}
          >
            {label && (
              <span className="absolute -top-6 left-0 text-[10px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                {label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
