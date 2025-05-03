import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
  // 自动复制设置
  const autoCopyText = ref(localStorage.getItem('autoCopyText') !== 'false');
  const autoCopyImage = ref(localStorage.getItem('autoCopyImage') === 'true');

  const hotkeySendText = ref(localStorage.getItem('hotkeySendText') || `Control+J`);
  const hotkeyScreenshot = ref(localStorage.getItem('hotkeyScreenshot') || `Control+K`);
  const hotkeyClipRegModifier = ref(localStorage.getItem('hotkeyClipRegModifier') || `Control`); // 剪切板寄存器修饰键

  // 显示器设置
  const selectedMonitor = ref(Number(localStorage.getItem('selectedMonitor') || 0));

  const setAutoCopyText = (value: boolean) => {
    autoCopyText.value = value;
    localStorage.setItem('autoCopyText', value.toString());
  };

  const setAutoCopyImage = (value: boolean) => {
    autoCopyImage.value = value;
    localStorage.setItem('autoCopyImage', value.toString());
  };

  const setReadClipboardTextHotkeySendText = (newHotkey: string) => {
    hotkeySendText.value = newHotkey;
    localStorage.setItem('hotkeySendText', newHotkey);
  };

  const setReadClipboardTextHotkeyScreenshot = (newHotkey: string) => {
    hotkeyScreenshot.value = newHotkey;
    localStorage.setItem('hotkeyScreenshot', newHotkey);
  };

  const setHotkeyClipRegModifier = (newHotkey: string) => {
    hotkeyClipRegModifier.value = newHotkey;
    localStorage.setItem('hotkeyClipRegModifier', newHotkey);
  };

  const setSelectedMonitor = (index: number) => {
    selectedMonitor.value = index;
    localStorage.setItem('selectedMonitor', index.toString());
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