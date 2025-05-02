import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
  // 自动复制设置
  const autoCopyText = ref(true);
  const autoCopyImage = ref(false);

  const hotkeySendText = ref(`Control+J`);
  const hotkeyScreenshot = ref(`Control+K`);
  const hotkeyClipRegModifier = ref(`Control`); // 剪切板寄存器修饰键

  // 显示器设置
  const selectedMonitor = ref(0);

  const setAutoCopyText = (value: boolean) => {
    autoCopyText.value = value;
  };

  const setAutoCopyImage = (value: boolean) => {
    autoCopyImage.value = value;
  };

  const setReadClipboardTextHotkeySendText = (newHotkey: string) => {
    hotkeySendText.value = newHotkey;
  };

  const setReadClipboardTextHotkeyScreenshot = (newHotkey: string) => {
    hotkeyScreenshot.value = newHotkey;
  };

  const setHotkeyClipRegModifier = (newHotkey: string) => {
    hotkeyClipRegModifier.value = newHotkey;
  };

  const setSelectedMonitor = (index: number) => {
    selectedMonitor.value = index;
  };

  return {
    autoCopyText,
    autoCopyImage,
    hotkeySendText,
    hotkeyScreenshot,
    hotkeyClipRegModifier,
    selectedMonitor,
    setAutoCopyText,
    setAutoCopyImage,
    setReadClipboardTextHotkeySendText,
    setReadClipboardTextHotkeyScreenshot,
    setHotkeyClipRegModifier,
    setSelectedMonitor,
  };
}); 