'use client';

import { COMPETENCY_THEMES } from '@/lib/theme-config';
import { RSCertificationCode } from '@/lib/types';
import { Shield, X } from 'lucide-react';
import React from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
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
          Référentiel
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Consultation du référentiel des thèmes de compétences.
        </p>

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
