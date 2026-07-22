'use client';

import { COMPETENCY_THEMES } from '@/lib/theme-config';
import { RSCertificationCode } from '@/lib/types';
import { CheckCircle2, Key, Shield, X } from 'lucide-react';
import React, { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  isAutoConnected?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  isAutoConnected = false,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-teal-400" />
          Paramètres du Générateur
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Configuration des clés d’API Anthropic Claude et du référentiel des thèmes.
        </p>

        {/* Section 9.3 — Claude API Key Storage */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Key className="h-4 w-4 text-amber-400" />
              Clé API Anthropic (Claude)
            </label>

            {isAutoConnected && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" /> Auto-Connectée (.env.local)
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            La clé est automatiquement chargée depuis votre fichier <code className="text-teal-300">.env.local</code> et active pour la génération dynamique de texte.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              value={inputKey || (isAutoConnected ? '••••••••••••••••••••••••••••••••' : '')}
              onChange={(e) => setInputKey(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
            />
            <button
              onClick={() => {
                onSaveApiKey(inputKey);
                onClose();
              }}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>

        {/* Annex B — Competency Theme Reference */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Référentiel des Thèmes de Compétences (Annexe B)
          </h3>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-3 text-xs">
            {(['RS6485', 'RS7200', 'RS7311', 'RS7344'] as RSCertificationCode[]).map((code) => (
              <div key={code}>
                <span className="font-semibold text-teal-300 text-[11px]">{code}</span>
                <ul className="list-disc list-inside text-[11px] text-slate-400 mt-1 space-y-0.5">
                  {COMPETENCY_THEMES[code].map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
