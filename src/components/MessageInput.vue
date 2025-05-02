<template>
  <div class="message-input-container flex flex-col space-y-1">
    <div class="buttons-row flex justify-start space-x-4 px-2">
      <ButtonsPanel 
        @triggerImageUpload="imageInput?.click()" 
        @toggleSettingsModal="$emit('toggleSettingsModal')" 
        @openRegisterModal="$emit('openRegisterModal')" 
        :isConnected="connectionStore.isConnected"
      />
    </div>
    
    <div class="input-area flex items-end">
      <textarea
        v-model="message"
        placeholder="Type your message here..."
        @keydown.enter="(event) => {
          if (!event.shiftKey) {
            event.preventDefault();
            sendText();
          }
        }"
        @input="adjustHeight"
        ref="textareaRef"
        class="w-full p-4 rounded-lg resize-none focus:outline-none bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-white border-0"
      ></textarea>
      
      <div class="relative ml-2 flex-shrink-0">
        <div class="send-button-capsule flex rounded-full overflow-hidden bg-blue-500">
          <button 
            @click="sendText()"
            class="send-icon-part text-white flex items-center justify-center px-3 h-full hover:bg-blue-600 transition-colors"
          >
            <font-awesome-icon :icon="['fas', 'paper-plane']" class="w-4 h-4" />
          </button>
          
          <div class="border-r border-blue-400 opacity-50"></div>
          
          <button 
            @click.stop="showDropdown = !showDropdown" 
            class="dropdown-icon-part text-white flex items-center justify-center px-2 h-full hover:bg-blue-600 transition-colors" 
            aria-label="发送选项"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        <div 
          v-if="showDropdown" 
          class="absolute z-10 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-md shadow-lg py-1 w-64 min-w-[200px] max-h-[200px] overflow-y-auto"
        >
          <div class="text-xs text-gray-500 px-4 py-1 border-b border-gray-100 text-center">剪切板寄存器</div>
          <div class="grid grid-cols-5 gap-2 p-3">
            <button 
              v-for="i in 5" 
              :key="`reg-${i}`" 
              @click="sendTextToRegister(i-1)" 
              class="flex items-center justify-center p-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
            >
              {{ i }}
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <input
      type="file"
      ref="imageInput"
      accept="image/*"
      @change="sendImage"
      class="hidden"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import SendingService from '../services/SendingService';
import { useConnectionStore } from '../stores/useConnectionStore';
import ButtonsPanel from './ButtonsPanel.vue';

defineEmits(['toggleSettingsModal', 'openRegisterModal']);

const message = ref('');
const imageInput = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const connectionStore = useConnectionStore();
const showDropdown = ref(false);

const sendText = async (clipRegIndex?: number) => {
  const content = message.value.trim();
  if (!content) return;
  
  try {
    await SendingService.sendTextMessage(content, clipRegIndex);
    message.value = '';
    if (textareaRef.value) {
      const computedStyle = getComputedStyle(textareaRef.value);
      const lineHeight = parseInt(computedStyle.lineHeight);
      const paddingTop = parseInt(computedStyle.paddingTop);
      const paddingBottom = parseInt(computedStyle.paddingBottom);
      textareaRef.value.style.height = `${lineHeight + paddingTop + paddingBottom}px`;
    }
  } catch (error) {
    console.error('消息发送失败:', error);
  }
};

const sendImage = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  
  try {
    await SendingService.sendImageMessage(file);
    (event.target as HTMLInputElement).value = '';
  } catch (error) {
    console.error('图片发送失败:', error);
  }
};

const sendTextToRegister = (registerIndex: number) => {
  sendText(registerIndex);
  showDropdown.value = false;
};

const adjustHeight = () => {
  const textarea = textareaRef.value;
  if (!textarea) return;
  
  textarea.style.height = 'auto';
  
  // 首先计算一行文本的大致高度
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
  
  // 计算内容行数
  const lines = textarea.value.split('\n').length;
  
  // 计算新高度，加上适当的padding (16px 总共)，但限制最大高度
  const baseHeight = Math.max(28, lineHeight); // 保证至少有足够高度显示一行文本
  const newHeight = Math.min(
    baseHeight + (lines - 1) * lineHeight + 16, // 每行文字的高度加上padding
    5 * lineHeight + 16 // 最大5行
  );
  
  textarea.style.height = `${newHeight}px`;
};

const closeDropdown = () => {
  showDropdown.value = false;
};

onMounted(() => {
  if (textareaRef.value) {
    // 获取计算后的样式来设置初始高度
    const computedStyle = getComputedStyle(textareaRef.value);
    const lineHeight = parseInt(computedStyle.lineHeight);
    const paddingTop = parseInt(computedStyle.paddingTop);
    const paddingBottom = parseInt(computedStyle.paddingBottom);
    
    // 设置初始高度 - 一行文字加上padding
    const initialHeight = lineHeight + paddingTop + paddingBottom;
    textareaRef.value.style.height = `${initialHeight}px`;
  }
  document.addEventListener('click', closeDropdown);
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});
</script>

<style scoped>
.input-area {
  flex: 1;
}

.input-area textarea {
  width: 100%;
  min-height: 44px;
  max-height: 120px;
  padding: 10px 16px;
  border-radius: 0.75rem;
  resize: none;
  font-size: 14px;
  outline: none;
  background-color: #f0f0f0;
  color: #333;
  line-height: 1.6;
  overflow-y: auto;
  vertical-align: middle;
  box-sizing: border-box;
}

.send-button-capsule {
  display: flex;
  align-items: center;
  height: 36px;
  min-height: 36px; 
  width: 75px;
  margin-bottom: 4px;
}

.send-icon-part, .dropdown-icon-part {
  height: 100%;
  width: 100%;
}

@media (max-width: 600px) {
  .input-area textarea {
    padding: 8px 14px;
    font-size: 12px;
    min-height: 38px;
  }
  
  .send-button-capsule {
    height: 32px;
    min-height: 32px;
    width: 70px;
    margin-bottom: 3px;
  }
}
</style>

