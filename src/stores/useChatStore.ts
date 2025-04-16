import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Message {
  id?: number;
  type: 'text' | 'image';
  content: string;
  userId: string;
  timestamp: string;
  clipReg?: number;
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([]);
  const lastMessageId = ref<number>(0);

  const addMessage = (message: Message) => {
    messages.value.push(message);
    
    if (message.id && message.id > lastMessageId.value) {
      lastMessageId.value = message.id;
    }
  };

  const clearMessages = () => {
    messages.value = [];
    lastMessageId.value = 0;
  };

  return {
    messages,
    lastMessageId,
    addMessage,
    clearMessages,
  };
});

