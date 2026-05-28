import React, { useState, useEffect, useRef } from 'react';
import { Key, Save, Check, Globe, Cpu, Download, Upload, MapPin, Banknote, Building2, Briefcase, X } from 'lucide-react';
import { api } from '../../utils/ipc';
import type { JobPreferences } from '../../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_PREFS: JobPreferences = {
  cities: [], salaryMin: '', salaryMax: '', industries: [], jobTypes: [], excludeCompanies: [], notes: ''
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [prefs, setPrefs] = useState<JobPreferences>(DEFAULT_PREFS);
  const [newCity, setNewCity] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newJobType, setNewJobType] = useState('');
  const [saved, setSaved] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<boolean>(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    Promise.all([api.getApiKey(), api.getApiBaseUrl(), api.getModel(), api.getPreferences()]).then(([key, url, loadedModel, loadedPrefs]) => {
      if (ignore) return;
      setApiKey(key || '');
      setBaseUrl(url || '');
      setModel(loadedModel || '');
      setPrefs(loadedPrefs || DEFAULT_PREFS);
      setTransferMessage(null);
    });

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    await api.setApiKey(apiKey);
    await api.setApiBaseUrl(baseUrl);
    await api.setModel(model);
    await api.setPreferences(prefs);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  const addToList = (field: 'cities' | 'industries' | 'jobTypes', value: string, setter: (v: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed || prefs[field].includes(trimmed)) return;
    setPrefs({ ...prefs, [field]: [...prefs[field], trimmed] });
    setter('');
  };

  const removeFromList = (field: 'cities' | 'industries' | 'jobTypes' | 'excludeCompanies', value: string) => {
    setPrefs({ ...prefs, [field]: prefs[field].filter((v) => v !== value) });
  };

  const handleExportData = async () => {
    setIsTransferring(true);
    const result = await api.exportData();
    setTransferSuccess(result.success);
    setTransferMessage(result.message);
    setIsTransferring(false);
  };

  const handleImportData = async () => {
    setIsTransferring(true);
    const result = await api.importData();
    setTransferSuccess(result.success);
    setTransferMessage(result.message);
    setIsTransferring(false);

    if (result.success) {
      setTimeout(() => window.location.reload(), 800);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">设置</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Globe size={16} />
                  API Base URL
                </div>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.deepseek.com/v1/chat/completions"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Cpu size={16} />
                  模型名称
                </div>
              </label>
              <input
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="deepseek-v4-flash"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Key size={16} />
                  API Key
                </div>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-gray-500 mt-1">
                在 <a href="https://platform.deepseek.com" target="_blank" className="text-primary hover:underline">DeepSeek 平台</a>{' '}
                获取 API Key
              </p>
            </div>

            {/* 求职偏好 */}
            <div className="pt-2 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">求职偏好</p>
              <div className="space-y-3">
                {/* 期望城市 */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <MapPin size={13} /> 期望城市
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {prefs.cities.map((c) => (
                      <span key={c} className="inline-flex items-center gap-0.5 text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                        {c}
                        <button onClick={() => removeFromList('cities', c)} className="hover:text-red-500"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input type="text" value={newCity} onChange={(e) => setNewCity(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToList('cities', newCity, setNewCity); } }}
                      placeholder="输入城市名后回车" className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    <button onClick={() => addToList('cities', newCity, setNewCity)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">添加</button>
                  </div>
                </div>

                {/* 薪资范围 */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Banknote size={13} /> 期望薪资
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={prefs.salaryMin} onChange={(e) => setPrefs({ ...prefs, salaryMin: e.target.value })}
                      placeholder="如 15k" className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    <span className="text-xs text-gray-400">~</span>
                    <input type="text" value={prefs.salaryMax} onChange={(e) => setPrefs({ ...prefs, salaryMax: e.target.value })}
                      placeholder="如 25k" className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                </div>

                {/* 期望行业 */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Building2 size={13} /> 期望行业
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {prefs.industries.map((ind) => (
                      <span key={ind} className="inline-flex items-center gap-0.5 text-xs bg-green-50 text-green-700 rounded px-1.5 py-0.5">
                        {ind}
                        <button onClick={() => removeFromList('industries', ind)} className="hover:text-red-500"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input type="text" value={newIndustry} onChange={(e) => setNewIndustry(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToList('industries', newIndustry, setNewIndustry); } }}
                      placeholder="如 互联网、AI" className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    <button onClick={() => addToList('industries', newIndustry, setNewIndustry)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">添加</button>
                  </div>
                </div>

                {/* 期望岗位 */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Briefcase size={13} /> 期望岗位
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {prefs.jobTypes.map((jt) => (
                      <span key={jt} className="inline-flex items-center gap-0.5 text-xs bg-amber-50 text-amber-700 rounded px-1.5 py-0.5">
                        {jt}
                        <button onClick={() => removeFromList('jobTypes', jt)} className="hover:text-red-500"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input type="text" value={newJobType} onChange={(e) => setNewJobType(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToList('jobTypes', newJobType, setNewJobType); } }}
                      placeholder="如 Python后端" className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    <button onClick={() => addToList('jobTypes', newJobType, setNewJobType)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">添加</button>
                  </div>
                </div>

                {/* 备注 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">其他要求</label>
                  <textarea value={prefs.notes} onChange={(e) => setPrefs({ ...prefs, notes: e.target.value })}
                    placeholder="如：不接受大小周、需要远程办公等" rows={2}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">数据管理</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportData}
                  disabled={isTransferring}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={15} />
                  导出数据
                </button>
                <button
                  onClick={handleImportData}
                  disabled={isTransferring}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload size={15} />
                  导入数据
                </button>
              </div>
              {transferMessage ? (
                <p className={`text-xs mt-2 ${transferSuccess ? 'text-green-600' : 'text-amber-600'}`}>{transferMessage}</p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                ${saved ? 'bg-green-600 text-white' : 'bg-primary text-white hover:bg-primary-hover'}
              `}
            >
              {saved ? <Check size={18} /> : <Save size={18} />}
              {saved ? '已保存' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
