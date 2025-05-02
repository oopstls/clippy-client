<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <button class="close-icon" @click="close" aria-label="关闭">
        <font-awesome-icon :icon="['fas', 'xmark']" class="w-5 h-5 text-gray-700 hover:text-gray-900" />
      </button>
      <h2 class="text-xl font-semibold mb-6">Settings</h2>
      
      <!-- 自动复制文本设置 - 仅在Tauri环境中显示 -->
      <div v-if="isTauriEnv" class="setting-item flex items-center justify-between mb-4">
        <label for="autoCopyText" class="text-md font-medium">自动复制文本到剪切板</label>
        <input 
          type="checkbox" 
          id="autoCopyText" 
          v-model="autoCopyText" 
          class="toggle-checkbox"
        />
      </div>
      
      <!-- 剪切板寄存器功能设置 - 仅在Tauri环境中显示 -->
      <div v-if="isTauriEnv" class="setting-item flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
          <label for="clipRegEnabled" class="text-md font-medium">剪切板寄存器</label>
          <font-awesome-icon 
            :icon="['fas', 'circle-info']" 
            class="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
            @mouseenter="tooltipState.clipReg = true"
            @mouseleave="tooltipState.clipReg = false"
          />
          <div 
            v-if="tooltipState.clipReg" 
            class="tooltip"
          >
            5个剪切板寄存器，使用快捷键操作：修饰键+1~5取出寄存器并粘贴，修饰键+6~0写入寄存器
          </div>
        </div>
        <input 
          type="checkbox" 
          id="clipRegEnabled" 
          v-model="clipRegEnabled" 
          class="toggle-checkbox"
        />
      </div>
      
      <!-- 剪切板寄存器同步设置 - 仅在剪切板寄存器启用时显示 -->
      <div v-if="isTauriEnv && clipRegEnabled" class="setting-item flex items-center justify-between mb-4 ml-6">
        <div class="flex items-center space-x-2">
          <label for="clipRegSyncEnabled" class="text-md font-medium">同步到其他设备</label>
          <font-awesome-icon 
            :icon="['fas', 'circle-info']" 
            class="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
            @mouseenter="tooltipState.clipRegSync = true"
            @mouseleave="tooltipState.clipRegSync = false"
          />
          <div 
            v-if="tooltipState.clipRegSync" 
            class="tooltip"
          >
            将剪切板寄存器内容同步到其他设备，同时在接收端自动存储
          </div>
        </div>
        <input 
          type="checkbox" 
          id="clipRegSyncEnabled" 
          v-model="clipRegSyncEnabled" 
          class="toggle-checkbox"
        />
      </div>
      
      <!-- 剪切板寄存器修饰键设置 - 仅在剪切板寄存器启用时显示 -->
      <div v-if="isTauriEnv && clipRegEnabled" class="setting-item flex items-center justify-between mb-4 ml-6 relative">
        <div class="flex items-center space-x-2">
          <label class="text-md font-medium">寄存器修饰键</label>
          <font-awesome-icon 
            :icon="['fas', 'circle-info']" 
            class="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
            @mouseenter="tooltipState.clipRegModifier = true"
            @mouseleave="tooltipState.clipRegModifier = false"
          />
          <div 
            v-if="tooltipState.clipRegModifier" 
            class="tooltip"
          >
            设置寄存器操作的修饰键，如Ctrl+1为粘贴1号寄存器内容
          </div>
        </div>
        <button
          @click="() => startListeningForClipRegModifier()"
          class="hotkey-button"
          :disabled="isListening"
        >
          <span v-if="!isListening || activeConfigType !== 'clipRegModifier'">{{ formatHotkey(hotkeyClipRegModifier) }}</span>
          <span v-else>按下新的热键...</span>
        </button>
        <div v-if="clipRegModifierError" class="error-text">{{ clipRegModifierError }}</div>
      </div>

      <!-- 热键设置 - 仅在Tauri环境中显示 -->
      <template v-if="isTauriEnv">
        <div v-for="(config, _) in hotkeyConfigs" 
             :key="config.type" 
             class="setting-item flex items-center justify-between mb-4 relative">
          <div class="flex items-center space-x-2">
            <label class="text-md">{{ config.label }}</label>
            <font-awesome-icon 
              v-if="config.tooltip"
              :icon="['fas', 'circle-info']" 
              class="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
              @mouseenter="tooltipState[config.type] = true"
              @mouseleave="tooltipState[config.type] = false"
            />
            <div 
              v-if="tooltipState[config.type] && config.tooltip" 
              class="tooltip"
            >
              {{ config.tooltip }}
            </div>
          </div>
          <button
            @click="() => startListening(config.type)"
            class="hotkey-button"
            :disabled="isListening"
          >
            <span v-if="!isListening || activeConfigType !== config.type">{{ config.currentHotkey }}</span>
            <span v-else>按下新的热键...</span>
          </button>
          <div v-if="errorMessages[config.type]" class="error-text">{{ errorMessages[config.type] }}</div>
        </div>
              
        <!-- 显示器选择 - 仅在Tauri环境中显示 -->
        <div class="setting-item flex items-center justify-between mb-4">
          <label for="monitorSelect" class="text-md font-medium">截图显示器</label>
          <select
            id="monitorSelect"
            v-model="selectedMonitor"
            class="monitor-select"
          >
            <option v-for="i in monitorCount" :key="i-1" :value="i-1">
              显示器 {{ i }}
            </option>
          </select>
        </div>
      </template>

      <!-- 非Tauri环境下显示提示信息 -->
      <div v-if="!isTauriEnv" class="setting-item text-center p-4 text-gray-600">
        自动复制、快捷键等功能仅在桌面客户端可用
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onBeforeUnmount, onMounted } from 'vue';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useClipRegStore } from '../stores/useClipRegStore';
import { getHotkeyService } from '../services/HotkeyService';
import { Toast } from 'vant';
import { invoke, isTauri } from '@tauri-apps/api/core';

// 类型定义
type HotkeyType = 'send' | 'screenshot' | 'clipRegModifier';
const VALID_MODIFIERS = ['Control', 'Alt', 'Shift', 'Meta'] as const;
type Modifier = typeof VALID_MODIFIERS[number];

interface HotkeyConfig {
  type: HotkeyType;
  label: string;
  tooltip?: string;
  currentHotkey: string;
  setter: (shortcut: string) => Promise<boolean>;
}

interface TooltipState {
  clipReg: boolean;
  clipRegSync: boolean;
  clipRegModifier: boolean;
  [key: string]: boolean;
}

// 常量配置
const HOTKEY_CONFIGS: Omit<HotkeyConfig, 'currentHotkey' | 'setter'>[] = [
  {
    type: 'send',
    label: '发送剪切板文本',
    tooltip: '发送剪切板文本内容，非文本不发送',
  },
  {
    type: 'screenshot',
    label: '截取全屏并发送',
  },
];

export default defineComponent({
  name: 'Settings',
  emits: ['close'],
  setup(_, { emit }) {
    // 状态管理
    const settingsStore = useSettingsStore();
    const clipRegStore = useClipRegStore();
    const hotkeyService = getHotkeyService();
    
    // 响应式状态
    const isTauriEnv = ref(isTauri());
    const isListening = ref(false);
    const activeConfigType = ref<HotkeyType | null>(null);
    const monitorCount = ref(1);
    const tooltipState = ref<TooltipState>({
      clipReg: false,
      clipRegSync: false,
      clipRegModifier: false,
      send: false,
      screenshot: false,
    });
    const errorMessages = ref<Record<HotkeyType, string>>({
      send: '',
      screenshot: '',
      clipRegModifier: '',
    });

    // 计算属性
    const autoCopyText = computed({
      get: () => settingsStore.autoCopyText,
      set: (value: boolean) => settingsStore.setAutoCopyText(value),
    });

    const clipRegEnabled = computed({
      get: () => clipRegStore.enabled,
      set: async (value: boolean) => {
        await hotkeyService.setClipRegEnabled(value);
      }
    });

    const clipRegSyncEnabled = computed({
      get: () => clipRegStore.syncEnabled,
      set: async (value: boolean) => {
        await hotkeyService.setClipRegSyncEnabled(value);
      }
    });

    const selectedMonitor = computed({
      get: () => settingsStore.selectedMonitor,
      set: (value: number) => settingsStore.setSelectedMonitor(value)
    });

    const hotkeyConfigs = computed<HotkeyConfig[]>(() => 
      HOTKEY_CONFIGS.map(config => ({
        ...config,
        currentHotkey: formatHotkey(
          config.type === 'send' 
            ? settingsStore.hotkeySendText 
            : config.type === 'screenshot' 
              ? settingsStore.hotkeyScreenshot
              : settingsStore.hotkeyClipRegModifier
        ),
        setter: config.type === 'send'
          ? hotkeyService.setReadClipboardTextHotkey.bind(hotkeyService)
          : config.type === 'screenshot'
            ? hotkeyService.setScreenshotHotkey.bind(hotkeyService)
            : hotkeyService.setClipRegModifier.bind(hotkeyService),
      }))
    );

    const hotkeyClipRegModifier = computed({
      get: () => settingsStore.hotkeyClipRegModifier,
      set: (value: string) => settingsStore.setHotkeyClipRegModifier(value)
    });

    const clipRegModifierError = computed(() => errorMessages.value.clipRegModifier);

    // 工具函数
    const formatHotkey = (hotkey: string) => hotkey.replace(/Control/g, 'Ctrl');

    const validateHotkey = (keys: string[]): { isValid: boolean; message?: string } => {
      const modifiers = keys.filter(k => VALID_MODIFIERS.includes(k as Modifier));
      const nonModifiers = keys.filter(k => !VALID_MODIFIERS.includes(k as Modifier));

      if (modifiers.length === 0) {
        return { isValid: false, message: '请至少包含一个修饰键 (Ctrl/Alt)' };
      }
      
      if (nonModifiers.length !== 1) {
        return { isValid: false, message: '请包含一个非修饰键' };
      }

      return { isValid: true };
    };

    // 事件处理
    const startListening = async (type: HotkeyType) => {
      if (isListening.value) return;
      
      isListening.value = true;
      activeConfigType.value = type;
      errorMessages.value[type] = '';

      const handleKeyDown = async (event: KeyboardEvent) => {
        event.preventDefault();
        
        const keys: string[] = [];
        if (event.ctrlKey) keys.push('Control');
        if (event.altKey) keys.push('Alt');
        if (event.shiftKey) keys.push('Shift');
        if (event.metaKey) keys.push('Meta');

        const key = event.key.toUpperCase();
        if (!VALID_MODIFIERS.includes(key as Modifier) && key.length === 1) {
          keys.push(key);
        } else {
          return;
        }

        const validation = validateHotkey(keys);
        if (!validation.isValid) {
          errorMessages.value[type] = validation.message || '';
          return;
        }

        const newShortcut = keys.join('+');
        const config = hotkeyConfigs.value.find(c => c.type === type);
        
        if (config) {
          try {
            const success = await config.setter(newShortcut);
            if (success) {
              Toast.success('热键设置成功');
            } else {
              errorMessages.value[type] = '该热键已被占用';
            }
          } catch (error) {
            errorMessages.value[type] = '设置热键失败，请重试';
            console.error('热键设置错误:', error);
          }
        }

        cleanup();
      };

      const cleanup = () => {
        isListening.value = false;
        activeConfigType.value = null;
        window.removeEventListener('keydown', handleKeyDown);
      };

      window.addEventListener('keydown', handleKeyDown);
    };

    const startListeningForClipRegModifier = async () => {
      if (isListening.value) return;
      
      isListening.value = true;
      activeConfigType.value = 'clipRegModifier';
      errorMessages.value.clipRegModifier = '';

      const handleKeyDown = async (event: KeyboardEvent) => {
        event.preventDefault();
        
        const keys: string[] = [];
        if (event.ctrlKey) keys.push('Control');
        if (event.altKey) keys.push('Alt');
        if (event.shiftKey) keys.push('Shift');
        if (event.metaKey) keys.push('Meta');
        
        // 修饰键必须只有一个
        if (keys.length !== 1) {
          errorMessages.value.clipRegModifier = '请只选择一个修饰键 (Ctrl/Alt/Shift)';
          return;
        }

        try {
          const success = await hotkeyService.setClipRegModifier(keys[0]);
          if (success) {
            Toast.success('修饰键设置成功');
          } else {
            errorMessages.value.clipRegModifier = '修饰键设置失败';
          }
        } catch (error) {
          errorMessages.value.clipRegModifier = '设置失败，请重试';
          console.error('修饰键设置错误:', error);
        }

        cleanup();
      };

      const cleanup = () => {
        isListening.value = false;
        activeConfigType.value = null;
        window.removeEventListener('keydown', handleKeyDown);
      };

      window.addEventListener('keydown', handleKeyDown);
    };

    const getMonitorCount = async () => {
      if (!isTauriEnv.value) return;
      
      try {
        const count = await invoke<number>('get_monitor_count');
        monitorCount.value = count;
      } catch (error) {
        console.error('获取显示器数量失败:', error);
      }
    };

    onMounted(() => {
      if (isTauriEnv.value) {
        getMonitorCount();
      }
    });

    onBeforeUnmount(() => {
      if (isListening.value) {
        window.removeEventListener('keydown', () => {});
      }
    });

    return {
      autoCopyText,
      close: () => emit('close'),
      isListening,
      tooltipState,
      activeConfigType,
      hotkeyConfigs,
      startListening,
      startListeningForClipRegModifier,
      errorMessages,
      clipRegModifierError,
      selectedMonitor,
      monitorCount,
      isTauriEnv,
      clipRegEnabled,
      clipRegSyncEnabled,
      hotkeyClipRegModifier,
      formatHotkey,
    };
  },
});
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 bg-black/50 flex justify-center items-center z-[2000];
}

.modal-content {
  @apply relative bg-white p-8 rounded-3xl w-[400px] max-w-[90%] shadow-lg;
}

.close-icon {
  @apply absolute top-4 right-4 bg-transparent border-none cursor-pointer text-gray-600 hover:text-gray-900 transition-colors;
}

.modal-content h2 {
  @apply text-xl font-semibold mb-6 mt-0;
}

.setting-item {
  @apply flex items-center justify-between mb-6 relative;
}

.toggle-checkbox {
  @apply appearance-none w-12 h-6 bg-gray-300 rounded-full relative cursor-pointer transition-colors;
}

.toggle-checkbox:checked {
  @apply bg-blue-600;
}

.toggle-checkbox::before {
  @apply content-[''] absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform;
}

.toggle-checkbox:checked::before {
  @apply translate-x-6;
}

.tooltip {
  @apply absolute ml-2 w-64 bg-gray-800 text-white text-xs rounded p-2 shadow-lg;
  bottom: 80%;
  left: 0;
  margin-top: 4px;
  z-index: 100;
}

.error-text {
  @apply text-red-500 text-sm mt-1 absolute -bottom-5 left-0;
}

.hotkey-button {
  @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none disabled:opacity-50;
}

.monitor-select {
  @apply px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500;
}
</style>

