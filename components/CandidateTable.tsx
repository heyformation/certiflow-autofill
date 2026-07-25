'use client';

import { CandidateRow } from '@/lib/types';
import { AlertCircle, CheckCircle2, Download, FileCheck, Play, Search, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

interface CandidateTableProps {
  candidates: CandidateRow[];
  onToggleGenererMaintenant: (id: string) => void;
  onGenerateCandidate: (candidate: CandidateRow) => void;
  onBatchGenerate: (selectedCandidates: CandidateRow[]) => void;
  isGenerating: boolean;
  autoMode?: boolean;
}

export const CandidateTable: React.FC<CandidateTableProps> = ({
  candidates,
  onToggleGenererMaintenant,
  onGenerateCandidate,
  onBatchGenerate,
  isGenerating,
  autoMode = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('ALL');
  const [rsFilter, setRsFilter] = useState<string>('ALL');
  const [readyFilter, setReadyFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering logic
  const filteredCandidates = candidates.filter((c) => {
    const fullName = `${c.prenom} ${c.nom}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      c.formation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.mail && c.mail.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesOrg = orgFilter === 'ALL' || c.organisme === orgFilter;
    const matchesRs = rsFilter === 'ALL' || c.code_certif === rsFilter;

    let matchesReady = true;
    if (readyFilter === 'READY') matchesReady = c.pret_pour_generation;
    else if (readyFilter === 'CLASSIQUE') matchesReady = c.pret_generation_classique;
    else if (readyFilter === 'WEDOF') matchesReady = c.pret_generation_wedof;
    else if (readyFilter === 'INCOMPLETE') matchesReady = !c.pret_pour_generation;

    return matchesSearch && matchesOrg && matchesRs && matchesReady;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCandidates.map((c) => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id));
  const readyCount = candidates.filter((c) => c.pret_pour_generation).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Category Tabs by Certification */}
      <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-2 uppercase tracking-wider">
            Catégories Certification :
          </span>
          {[
            { key: 'ALL', label: 'Toutes les Certifications', count: candidates.length },
            {
              key: 'RS6485',
              label: 'RS6485 — Comptabilité TPE',
              count: candidates.filter((c) => c.code_certif === 'RS6485').length,
            },
            {
              key: 'RS7200',
              label: 'RS7200 — Réseaux Sociaux',
              count: candidates.filter((c) => c.code_certif === 'RS7200').length,
            },
            {
              key: 'RS7311',
              label: 'RS7311 — IA TPE',
              count: candidates.filter((c) => c.code_certif === 'RS7311').length,
            },
            {
              key: 'RS7344',
              label: 'RS7344 — IA Activité',
              count: candidates.filter((c) => c.code_certif === 'RS7344').length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRsFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                rsFilter === tab.key
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  rsFilter === tab.key
                    ? 'bg-teal-400/20 text-teal-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Quick Batch Button for All Ready Candidates */}
        {readyCount > 0 && (
          <button
            onClick={() =>
              onBatchGenerate(candidates.filter((c) => c.pret_pour_generation || c.generer_maintenant))
            }
            disabled={isGenerating}
            className="flex items-center space-x-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>Tout Générer (Tous les Prêts : {readyCount})</span>
          </button>
        )}
      </div>

      {/* Table Toolbar / Controls */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par candidat, formation, e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Org Filter */}
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">Tous les Organismes</option>
            <option value="Proforma Institut">Proforma Institut</option>
            <option value="Proskills Institut">Proskills Institut</option>
          </select>

          {/* Readiness Filter */}
          <select
            value={readyFilter}
            onChange={(e) => setReadyFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-medium"
          >
            <option value="ALL">Tous les Statuts</option>
            <option value="READY">Prêt pour Génération (TRUE)</option>
            <option value="CLASSIQUE">Prêt Classique (TRUE)</option>
            <option value="WEDOF">Prêt WeDOF (TRUE)</option>
            <option value="INCOMPLETE">Champs Incomplets (FALSE)</option>
          </select>
        </div>

        {/* Batch Actions for Checkbox Selected */}
        {selectedIds.length > 0 && (
          <button
            onClick={() => onBatchGenerate(selectedCandidates)}
            disabled={isGenerating}
            className="flex items-center space-x-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Générer Pack ZIP Sélection ({selectedIds.length})</span>
          </button>
        )}
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
            <tr>
              <th className="p-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={
                    filteredCandidates.length > 0 &&
                    selectedIds.length === filteredCandidates.length
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-teal-600 focus:ring-teal-500"
                />
              </th>
              <th className="p-4">Apprenant</th>
              <th className="p-4">Organisme</th>
              <th className="p-4">Certification</th>
              <th className="p-4 text-center">Prêt pour Génération</th>
              <th className="p-4 text-center">Générer Maintenant</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredCandidates.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                  Aucun candidat ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            ) : (
              filteredCandidates.map((c) => {
                const isProforma = c.organisme === 'Proforma Institut';
                const isReady = c.pret_pour_generation;
                const canGenerate = isReady || c.generer_maintenant;

                return (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleSelectOne(c.id)}
                        className="rounded border-slate-700 bg-slate-900 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="p-4 font-medium text-white">
                      <div className="font-semibold text-slate-100">
                        {c.civilite ? `${c.civilite} ` : ''}
                        {c.prenom} {c.nom}
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {c.mail || c.mail_wedof || c.mail_crm || 'Sans email'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          isProforma
                            ? 'bg-[#6E1F14]/20 text-red-300 border-[#6E1F14]/40'
                            : 'bg-[#0B3D3D]/30 text-teal-300 border-[#0B3D3D]/50'
                        }`}
                      >
                        {c.organisme}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-200">{c.code_certif}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {c.formation}
                      </div>
                    </td>

                    {/* PRET POUR GENERATION BADGE */}
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold border ${
                            isReady
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {isReady ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> TRUE
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3.5 w-3.5 text-amber-400" /> FALSE
                            </>
                          )}
                        </span>
                        {isReady && (
                          <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            {c.pret_generation_classique && (
                              <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/50">
                                Classique
                              </span>
                            )}
                            {c.pret_generation_wedof && (
                              <span className="bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-800/50">
                                WeDOF
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* GENERER MAINTENANT TOGGLE SWITCH */}
                    <td className="p-4 text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={c.generer_maintenant}
                          onChange={() => onToggleGenererMaintenant(c.id)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600 relative"></div>
                      </label>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => onGenerateCandidate(c)}
                        disabled={isGenerating || !canGenerate}
                        className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold px-3.5 py-1.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-teal-600"
                      >
                        <Play className="h-3.5 w-3.5 fill-white" />
                        <span>Générer</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
