import React, { useEffect, useState } from 'react';
import { FileText, Upload, UserRound, Save, X } from 'lucide-react';
import { api } from '../../utils/ipc';

interface ResourceLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResourceLibraryModal: React.FC<ResourceLibraryModalProps> = ({ isOpen, onClose }) => {
  const [resumeText, setResumeText] = useState('');
  const [selfIntroText, setSelfIntroText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setImportMessage('');
      setImportError(false);
      setIsImportingPdf(false);
      return;
    }

    let ignore = false;
    api.getProfile().then((profile) => {
      if (ignore) return;
      setResumeText(profile?.resumeText ?? '');
      setSelfIntroText(profile?.selfIntroText ?? '');
    });

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.setProfile({ resumeText, selfIntroText });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportPdf = async () => {
    setIsImportingPdf(true);
    setImportMessage('');
    setImportError(false);
    try {
      const result = await api.importResumePdf();
      if (result.success && result.text) {
        setResumeText(result.text);
      }
      setImportMessage(result.message);
      setImportError(!result.success);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      setImportMessage(`导入失败：${message}`);
      setImportError(true);
    } finally {
      setIsImportingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">资源库</h2>
            <p className="text-sm text-gray-500 mt-1">保存你的简历与自我介绍，分析 JD 时会自动使用。</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2 gap-3">
              <label className="block text-sm font-medium text-gray-700">
                <span className="inline-flex items-center gap-2">
                  <FileText size={16} />
                  我的简历文本
                </span>
              </label>
              <button
                onClick={handleImportPdf}
                disabled={isImportingPdf}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-md hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <Upload size={14} />
                {isImportingPdf ? '解析中...' : '上传 PDF'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">支持上传 PDF 简历，系统会自动提取文本并覆盖当前简历内容。</p>
            {importMessage ? (
              <p className={`text-xs mb-2 ${importError ? 'text-red-600' : 'text-green-600'}`}>{importMessage}</p>
            ) : null}
            <textarea
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="粘贴简历正文（建议包含项目经历、技能、教育等核心信息）"
              className="w-full h-72 p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="inline-flex items-center gap-2">
                <UserRound size={16} />
                自我介绍（可选）
              </span>
            </label>
            <textarea
              value={selfIntroText}
              onChange={(event) => setSelfIntroText(event.target.value)}
              placeholder="可提前沉淀你的 1 分钟版本自我介绍"
              className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <Save size={16} />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};
