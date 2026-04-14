import { create } from 'zustand';
import type { BattleCard, CardStatus } from '../types';
import { api } from '../utils/ipc';
import { useChatStore } from './chat';

interface CardsState {
  cards: BattleCard[];
  selectedCardId: string | null;
  isLoading: boolean;
  
  // Actions
  loadCards: () => Promise<void>;
  selectCard: (id: string | null) => void;
  createCard: (card: Omit<BattleCard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCard: (id: string, updates: Partial<BattleCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  updateStatus: (id: string, status: CardStatus) => Promise<void>;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useCardsStore = create<CardsState>((set, get) => ({
  cards: [],
  selectedCardId: null,
  isLoading: false,

  loadCards: async () => {
    set({ isLoading: true });
    try {
      const cards = await api.getCards();
      set({ cards, isLoading: false });
    } catch (error) {
      console.error('Failed to load cards:', error);
      set({ isLoading: false });
    }
  },

  selectCard: (id) => {
    const chatState = useChatStore.getState();
    if (chatState.mode === 'mock' && id !== chatState.mockCardId) {
      chatState.clearMessages();
      chatState.resetMockState();
    }
    set({ selectedCardId: id });
  },

  createCard: async (cardData) => {
    const now = new Date().toISOString();
    const newCard: BattleCard = {
      ...cardData,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    
    await api.createCard(newCard);
    await get().loadCards();
    set({ selectedCardId: newCard.id });
  },

  updateCard: async (id, updates) => {
    await api.updateCard(id, updates);
    await get().loadCards();
  },

  deleteCard: async (id) => {
    await api.deleteCard(id);
    const { selectedCardId } = get();
    if (selectedCardId === id) {
      set({ selectedCardId: null });
    }
    await get().loadCards();
  },

  updateStatus: async (id, status) => {
    await get().updateCard(id, { status });
  }
}));
