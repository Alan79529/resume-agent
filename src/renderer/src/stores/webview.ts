import { create } from 'zustand';
import type { WebviewTab } from '../types';

interface WebviewState {
  tabs: WebviewTab[];
  activeTabId: string | null;
  
  // Actions
  addTab: (url?: string) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useWebviewStore = create<WebviewState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (url = 'https://www.zhipin.com') => {
    const id = generateId();
    const newTab: WebviewTab = {
      id,
      url,
      title: '新标签页',
      isActive: true
    };
    
    set(state => ({
      tabs: state.tabs.map(t => ({ ...t, isActive: false })).concat(newTab),
      activeTabId: id
    }));
    
    return id;
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const index = tabs.findIndex(t => t.id === id);
    
    if (index === -1) return;
    
    const newTabs = tabs.filter(t => t.id !== id);
    let newActiveId = activeTabId;
    
    // If closing active tab, activate previous or next
    if (activeTabId === id && newTabs.length > 0) {
      const newIndex = Math.min(index, newTabs.length - 1);
      newActiveId = newTabs[newIndex].id;
      newTabs[newIndex] = { ...newTabs[newIndex], isActive: true };
    }
    
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id) => {
    set(state => ({
      tabs: state.tabs.map(t => ({ ...t, isActive: t.id === id })),
      activeTabId: id
    }));
  },

  updateTabTitle: (id, title) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === id ? { ...t, title } : t)
    }));
  }
}));
