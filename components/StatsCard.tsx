'use client';

import { AlertCircle, CheckCircle2, FileCheck, Users } from 'lucide-react';
import React from 'react';

interface StatsCardProps {
  total: number;
  ready: number;
  incomplete: number;
  generated: number;
}

export const StatsCard: React.FC<StatsCardProps> = ({ total, ready, incomplete, generated }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Total Candidats</p>
          <p className="text-2xl font-bold text-white mt-1">{total}</p>
        </div>
        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
          <Users className="h-6 w-6" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Prêts pour Génération</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{ready}</p>
        </div>
        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Champs Incomplets</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{incomplete}</p>
        </div>
        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
          <AlertCircle className="h-6 w-6" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Documents Générés</p>
          <p className="text-2xl font-bold text-teal-400 mt-1">{generated}</p>
        </div>
        <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400">
          <FileCheck className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};
