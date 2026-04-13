import React, { useState, useEffect, useRef } from 'react';
import { Key, Save, Check, Globe, Cpu } from 'lucide-react';
import { api } from '../../utils/ipc';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    Promise.all([api.getApiKey(), api.getApiBaseUrl(), api.getModel()])
      .then(([key, url, m]) => {
        if (ignore) return;
        setApiKey(key || '');
        setBaseUrl(url || '');
        setModel(m || '');
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
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
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
                onChange={(e) => setBaseUrl(e.target.value)}
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
                onChange={(e) => setModel(e.target.value)}
                placeholder="deepseek-chat"
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
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-gray-500 mt-1">
                在 <a href="https://platform.deepseek.com" target="_blank" className="text-primary hover:underline">DeepSeek 平台</a> 获取 API Key
              </p>
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
                ${saved 
                  ? 'bg-green-600 text-white' 
                  : 'bg-primary text-white hover:bg-primary-hover'
                }
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
