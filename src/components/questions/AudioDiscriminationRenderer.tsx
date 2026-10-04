import React, { useState } from 'react';
import { AudioDiscriminationQuestion, UserAnswerPayload, AnswerEvaluationResult } from '../../models/question.types';
import { AudioPlayerCard } from '../audio/AudioPlayerCard';
import { Headphones, CheckCircle2 } from 'lucide-react';

export interface AudioDiscriminationRendererProps {
  question: AudioDiscriminationQuestion;
  currentAnswer: UserAnswerPayload | null;
  onAnswerChange: (answer: UserAnswerPayload) => void;
  evaluation: AnswerEvaluationResult | null;
  isSubmitted: boolean;
}

export const AudioDiscriminationRenderer: React.FC<AudioDiscriminationRendererProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  isSubmitted,
}) => {
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);

  const selectedAudio =
    currentAnswer && currentAnswer.type === 'AUDIO_DISCRIMINATION'
      ? currentAnswer.selected_audio
      : null;

  const handleSelect = (choice: 'audio_a' | 'audio_b') => {
    if (isSubmitted) return;
    onAnswerChange({
      type: 'AUDIO_DISCRIMINATION',
      selected_audio: choice,
    });
  };

  const handlePlayStateChange = (id: string, isPlaying: boolean) => {
    if (isPlaying) {
      setActivePlayingId(id);
    } else if (activePlayingId === id) {
      setActivePlayingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 w-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 rounded-xl border border-brand-100 text-xs font-semibold text-brand-800">
        <Headphones className="w-4 h-4 text-brand-600" />
        <span>Listen to both tracks, then select the better recording below:</span>
      </div>

      {/* Recording A */}
      <AudioPlayerCard
        id="audio_a"
        audioSrc={question.audio_asset_a}
        label={question.label_a || 'Recording 1'}
        subtitle="Tap to listen & compare"
        activePlayingId={activePlayingId}
        onPlayStateChange={handlePlayStateChange}
        selected={selectedAudio === 'audio_a'}
        onSelect={() => handleSelect('audio_a')}
        disabled={isSubmitted}
      />

      {/* Recording B */}
      <AudioPlayerCard
        id="audio_b"
        audioSrc={question.audio_asset_b}
        label={question.label_b || 'Recording 2'}
        subtitle="Tap to listen & compare"
        activePlayingId={activePlayingId}
        onPlayStateChange={handlePlayStateChange}
        selected={selectedAudio === 'audio_b'}
        onSelect={() => handleSelect('audio_b')}
        disabled={isSubmitted}
      />

      {/* Post-submission Clinical Finding highlight */}
      {isSubmitted && (
        <div className="p-3.5 bg-brand-50/80 rounded-2xl border border-brand-200 text-xs text-brand-900 flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Clinical Acoustic Finding:</span>
            <span>{question.clinical_finding}</span>
          </div>
        </div>
      )}
    </div>
  );
};
