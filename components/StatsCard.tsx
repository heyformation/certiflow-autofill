'use client';

import { AlertCircle, CheckCircle2, FileCheck, Layers, Users } from 'lucide-react';
import React from 'react';

interface StatsCardProps {
  total: number;
  readyClassique: number;
  readyWedof: number;
  totalReady: number;
  incomplete: number;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  total,
  readyClassique,
  readyWedof,
  totalReady,
  incomplete,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Total Apprenants</p>
          <p className="text-2xl font-bold text-white mt-1">{total}</p>
        </div>
        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
          <Users className="h-5 w-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Prêt Classique</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{readyClassique}</p>
        </div>
        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Prêt WeDOF</p>
          <p className="text-2xl font-bold text-indigo-400 mt-1">{readyWedof}</p>
        </div>
        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
          <FileCheck className="h-5 w-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Total Éligibles (Prêt)</p>
          <p className="text-2xl font-bold text-teal-400 mt-1">{totalReady}</p>
        </div>
        <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400">
          <Layers className="h-5 w-5" />
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Champs Incomplets</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{incomplete}</p>
        </div>
        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
          <AlertCircle className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

