import React, { useState, useEffect, useRef } from 'react';
import { Key, Save, Check, Globe, Cpu, Download, Upload } from 'lucide-react';
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
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<boolean>(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    Promise.all([api.getApiKey(), api.getApiBaseUrl(), api.getModel()]).then(([key, url, loadedModel]) => {
      if (ignore) return;
      setApiKey(key || '');
      setBaseUrl(url || '');
      setModel(loadedModel || '');
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
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
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
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-gray-500 mt-1">
                在 <a href="https://platform.deepseek.com" target="_blank" className="text-primary hover:underline">DeepSeek 平台</a>{' '}
                获取 API Key
              </p>
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
