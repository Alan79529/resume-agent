import React from 'react';
import { ExternalLink, MapPin, Building2, Briefcase } from 'lucide-react';

// --- Types matching Python tool response formats ---

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchData {
  results: WebSearchResult[];
  source?: string;
  error?: string;
}

interface BossJobResult {
  title: string;
  company: string;
  salary: string;
  location: string;
  url: string;
  description: string;
}

interface BossSearchData {
  jobs: BossJobResult[];
  source?: string;
  error?: string;
}

// --- Web Search Results ---

export const WebSearchResults: React.FC<{ data: WebSearchData }> = ({ data }) => {
  if (!data.results?.length) {
    return (
      <div className="text-xs text-gray-500 py-1">
        {data.error || '未找到搜索结果'}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {data.results.map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-blue-300"
        >
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline line-clamp-1"
          >
            {item.title}
            <ExternalLink size={12} className="shrink-0 opacity-50" />
          </a>
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{item.url}</p>
          {item.snippet && (
            <p className="mt-1 text-xs leading-5 text-slate-600 line-clamp-2">{item.snippet}</p>
          )}
        </div>
      ))}
    </div>
  );
};

// --- Boss Search Results ---

export const BossSearchResults: React.FC<{ data: BossSearchData }> = ({ data }) => {
  if (!data.jobs?.length) {
    return (
      <div className="text-xs text-gray-500 py-1">
        {data.error || '未找到职位信息'}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {data.jobs.map((job, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-amber-300"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {job.url ? (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-amber-700 hover:underline line-clamp-1"
                >
                  <Briefcase size={12} className="shrink-0 text-amber-500" />
                  {job.title}
                  <ExternalLink size={12} className="shrink-0 opacity-50" />
                </a>
              ) : (
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 line-clamp-1">
                  <Briefcase size={12} className="shrink-0 text-amber-500" />
                  {job.title}
                </span>
              )}
            </div>
            {job.salary && (
              <span className="shrink-0 whitespace-nowrap rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                {job.salary}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {job.company && (
              <span className="flex items-center gap-0.5 text-xs text-slate-600">
                <Building2 size={11} className="text-gray-400" />
                {job.company}
              </span>
            )}
            {job.location && (
              <span className="flex items-center gap-0.5 text-xs text-slate-500">
                <MapPin size={11} className="text-gray-400" />
                {job.location}
              </span>
            )}
          </div>

          {job.description && (
            <p className="mt-1.5 text-xs leading-5 text-slate-500 line-clamp-2">{job.description}</p>
          )}
        </div>
      ))}
    </div>
  );
};

// --- Generic Tool Result Dispatcher ---

export const ToolResultView: React.FC<{ toolName: string; resultData: unknown }> = ({ toolName, resultData }) => {
  if (!resultData) return null;

  if (toolName === 'web_search') {
    return <WebSearchResults data={resultData as WebSearchData} />;
  }

  if (toolName === 'boss_search') {
    return <BossSearchResults data={resultData as BossSearchData} />;
  }

  return null;
};
