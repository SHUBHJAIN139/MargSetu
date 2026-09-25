'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import { HonestyBadge } from '../../lib/labels';

/**
 * AudioBriefPlayer Component
 * Spec: DESIGN.md (FINAL v2) §3
 * "Advisory strip: one sentence + TTS row (EN/हि/অসম buttons, 44px)."
 * Light theme: white surface, soft borders, brand teal buttons.
 */
export default function AudioBriefPlayer({
  advisories = {
    en: 'NDMA SIMULATION: NH-6 Sonapur corridor passable with standard monsoon caution.',
    hi: 'एनडीएमए सिमुलेशन: एनएच-6 सोनापुर मार्ग सामान्य मानसूनी सतर्कता के साथ खुला है।',
    as: 'এনডিএমএ ছিমুলেচন: এনএইচ-৬ সোনাপুৰ কৰিড’ৰ সাধাৰণ বাৰিষাৰ সতৰ্কতাৰে চলাচলৰ বাবে উপযুক্ত।',
  },
  selectedLang = 'en',
  onLanguageChange = () => {},
  honestyLabel = 'VERIFIED STATIC',
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [availableVoices, setAvailableVoices] = useState([]);

  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSpeechSupported(false);
      return;
    }

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const currentText = advisories[selectedLang] || advisories.en || '';

  const stopAudio = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, []);

  const playAudio = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !currentText) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(currentText);
    utteranceRef.current = utterance;

    const langCodeMap = {
      en: 'en-IN',
      hi: 'hi-IN',
      as: 'as-IN',
    };

    const targetLang = langCodeMap[selectedLang] || 'en-US';
    utterance.lang = targetLang;
    utterance.rate = 0.95;

    const matchedVoice = availableVoices.find((v) =>
      v.lang.toLowerCase().startsWith(selectedLang.toLowerCase())
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [currentText, isPaused, selectedLang, availableVoices]);

  const pauseAudio = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      stopAudio();
      setTimeout(playAudio, 100);
    }
  }, [selectedLang]); // eslint-disable-line react-hooks/exhaustive-deps

  const languageTabs = [
    { code: 'en', label: 'EN', full: 'English' },
    { code: 'hi', label: 'हिं', full: 'हिन्दी' },
    { code: 'as', label: 'অস', full: 'অসমীয়া' },
  ];

  return (
    <div className="w-full bg-white border border-line rounded-xl p-3.5 shadow-xs flex flex-col gap-2.5">
      {/* Top row: Voice icon, Title, Honesty badge, Language buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#E6F4F1] border border-brand/20 text-brand flex items-center justify-center shrink-0">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-ink uppercase tracking-wide">
                Voice Advisory
              </span>
              <HonestyBadge label={honestyLabel} size="xs" />
            </div>
            <div className="text-[10px] text-muted font-mono">
              TTS Broadcast Engine
            </div>
          </div>
        </div>

        {/* Language Tabs (>=44px touch targets) */}
        <div className="flex items-center bg-[#FAF8F5] p-0.5 rounded-lg border border-line">
          {languageTabs.map((tab) => {
            const isActive = selectedLang === tab.code;
            return (
              <button
                key={tab.code}
                type="button"
                onClick={() => onLanguageChange(tab.code)}
                aria-label={`Switch voice advisory to ${tab.full}`}
                className={`min-h-[36px] min-w-[38px] px-2 rounded-md text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-white text-ink shadow-xs border border-line'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advisory Transcript */}
      <div className="bg-[#FAF8F5] p-3 rounded-lg border border-line text-xs leading-relaxed text-ink min-h-[50px] flex items-start justify-between gap-2 select-text">
        <p className="font-sans">
          {currentText || 'No active corridor emergency advisory available.'}
        </p>

        {isPlaying && (
          <div className="flex items-end gap-0.5 h-4 shrink-0 self-center px-1">
            <span className="w-1 h-3 bg-brand rounded-full animate-pulse" />
            <span className="w-1 h-4 bg-brand rounded-full animate-pulse [animation-delay:150ms]" />
            <span className="w-1 h-2 bg-brand rounded-full animate-pulse [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {/* Audio Playback Controls (>=44px touch targets) */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          {isPlaying ? (
            <button
              type="button"
              onClick={pauseAudio}
              className="min-h-touch px-4 py-2 bg-[#E08A00] hover:bg-[#B45309] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <Pause className="w-4 h-4" />
              Pause Audio
            </button>
          ) : (
            <button
              type="button"
              onClick={playAudio}
              className="min-h-touch px-4 py-2 bg-brand hover:bg-brand-dark active:bg-brand text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <Play className="w-4 h-4 fill-current" />
              Play Advisory ({selectedLang.toUpperCase()})
            </button>
          )}

          <button
            type="button"
            onClick={stopAudio}
            disabled={!isPlaying && !isPaused}
            className="min-h-touch min-w-touch p-2 bg-white hover:bg-paper text-muted hover:text-ink rounded-lg border border-line flex items-center justify-center transition-colors disabled:opacity-40"
            title="Reset Audio"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[10px] font-mono text-muted text-right">
          {speechSupported ? 'Web Speech API' : 'TTS Fallback'}
        </div>
      </div>
    </div>
  );
}
