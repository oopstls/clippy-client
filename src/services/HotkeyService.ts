import { register, unregister, isRegistered, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { platform } from '@tauri-apps/plugin-os';
import SendingService from './SendingService';
import SocketService from './SocketService';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useClipRegStore } from '../stores/useClipRegStore';
import { Toast } from 'vant';
import { invoke, isTauri } from '@tauri-apps/api/core';

// 热键回调函数类型
type HotkeyCallback = (event: any) => Promise<void>;

// 寄存器操作类型
enum RegisterOperation {
  PASTE, // 粘贴操作
  SAVE,  // 保存操作
  TYPE   // 模拟输入操作
}

// 寄存器配置接口
interface RegisterConfig {
  shortcut: string;
  operation: RegisterOperation;
  index: number;
}

class HotkeyService {
  private settingsStore: ReturnType<typeof useSettingsStore>;
  private clipRegStore: ReturnType<typeof useClipRegStore>;
  private isInitialized: boolean = false;
  private isTauriEnv: boolean = false;
  private isMacOS: boolean = false;
  
  // 寄存器配置
  private readonly REGISTER_COUNT = 5;
  private readonly SAVE_KEYS = ['6', '7', '8', '9', '0'];
  private registeredShortcuts: Set<string> = new Set();

  constructor() {
    this.settingsStore = useSettingsStore();
    this.clipRegStore = useClipRegStore();
    this.isTauriEnv = isTauri();
    this.isMacOS = this.isTauriEnv ? platform() === 'macos' : false;
    
    if (this.isTauriEnv) {
      this.initialize().catch(err => {
        console.error('初始化热键服务失败:', err);
      });
    } else {
      console.log('非Tauri环境，跳过热键初始化');
    }
  }

  // 在Tauri环境中执行函数，否则返回false
  private async inTauriOrFalse<T>(func: () => Promise<T>): Promise<T | false> {
    if (!this.isTauriEnv) return Promise.resolve(false);
    return func();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 注册发送文本热键
      if (!await this.setReadClipboardTextHotkey(this.settingsStore.hotkeySendText)) {
        Toast.fail(`发送文本热键 "${this.settingsStore.hotkeySendText}" 注册失败，请重启软件。`);
      }

      // 注册截图热键
      if (!await this.setScreenshotHotkey(this.settingsStore.hotkeyScreenshot)) {
        Toast.fail(`截图发送热键 "${this.settingsStore.hotkeyScreenshot}" 注册失败，请重启软件。`);
      }
      
      // 初始化剪切板寄存器热键
      await this.initClipRegHotkeys();
    } catch (error) {
      console.error('初始化热键服务失败:', error);
      Toast.fail('热键服务初始化失败');
    }
  }

  private adaptShortcutForPlatform(shortcut: string): string {
    if (!this.isMacOS) return shortcut;
    
    return shortcut.replace(/Alt/g, 'Command');
  }

  // 注册单个快捷键
  private async registerShortcut(
    newShortcut: string,
    callback: HotkeyCallback,
    oldShortcut?: string
  ): Promise<boolean> {
    if (!this.isTauriEnv) return false;

    try {
      const adaptedNewShortcut = this.adaptShortcutForPlatform(newShortcut);
      const adaptedOldShortcut = oldShortcut ? this.adaptShortcutForPlatform(oldShortcut) : undefined;
      
      const alreadyRegistered = await isRegistered(adaptedNewShortcut);
      if (alreadyRegistered) {
        Toast.fail(`热键 "${adaptedNewShortcut}" 已被其他应用占用。`);
        return false;
      }
      
      await register(adaptedNewShortcut, callback);
      this.registeredShortcuts.add(adaptedNewShortcut);
      
      if (adaptedOldShortcut && adaptedOldShortcut !== adaptedNewShortcut) {
        await this.unregisterShortcut(adaptedOldShortcut);
      }
      
      return true;
    } catch (error) {
      console.error(`注册热键失败 (${newShortcut}):`, error);
      return false;
    }
  }

  async setReadClipboardTextHotkey(newShortcut: string): Promise<boolean> {
    return this.inTauriOrFalse(async () => {
      const success = await this.registerShortcut(
        newShortcut, 
        async (event) => {
          if (event.state === 'Pressed') {
            try {
              const clipboardText = await readText();
              if (clipboardText) {
                SendingService.sendTextMessage(clipboardText);
              }
            } catch (error) {
              console.error('读取剪贴板失败:', error);
              Toast.fail('读取剪贴板失败');
            }
          }
        }, 
        this.settingsStore.hotkeySendText
      );
      
      if (success) {
        this.settingsStore.setReadClipboardTextHotkeySendText(newShortcut);
      }
      
      return success;
    });
  }

  async setScreenshotHotkey(newShortcut: string): Promise<boolean> {
    return this.inTauriOrFalse(async () => {
      const success = await this.registerShortcut(
        newShortcut, 
        async (event) => {
          if (event.state === 'Pressed') {
            try {
              const base64 = await invoke<string>('screenshot', {
                monitorIndex: this.settingsStore.selectedMonitor
              });
              
              if (base64) {
                SocketService.sendMessage('image', base64);
              }
            } catch (err) {
              console.error('截图失败:', err);
              Toast.fail('截图失败');
            }
          }
        }, 
        this.settingsStore.hotkeyScreenshot
      );
      
      if (success) {
        this.settingsStore.setReadClipboardTextHotkeyScreenshot(newShortcut);
      }
      
      return success;
    });
  }

  // 注销单个热键
  private async unregisterShortcut(shortcut: string): Promise<void> {
    if (!this.isTauriEnv) return;
    
    const adaptedShortcut = this.adaptShortcutForPlatform(shortcut);
    
    if (!this.registeredShortcuts.has(adaptedShortcut)) return;
    
    try {
      await unregister(adaptedShortcut);
      this.registeredShortcuts.delete(adaptedShortcut);
    } catch (error) {
      console.error(`注销热键失败 (${shortcut}):`, error);
    }
  }

  // 注销所有热键（在应用关闭时调用）
  async unregisterAll(): Promise<void> {
    if (!this.isTauriEnv) return;
    try {
      await unregisterAll();
      this.registeredShortcuts.clear();
      console.log('已注销所有全局热键。');
    } catch (error) {
      console.error('注销所有热键失败:', error);
    }
  }

  // 创建寄存器操作回调函数
  private createRegisterCallback(index: number, operation: RegisterOperation): HotkeyCallback {
    return async (event) => {
      if (event.state !== 'Pressed') return;
      
      try {
        switch (operation) {
          case RegisterOperation.PASTE:
          case RegisterOperation.TYPE:
            await this.handleRegisterRead(index, operation);
            break;
          case RegisterOperation.SAVE:
            await this.handleRegisterSave(index);
            break;
        }
      } catch (error) {
        console.error(`寄存器操作失败 (${RegisterOperation[operation]}):`, error);
        Toast.fail(`操作失败: ${error}`);
      }
    };
  }
  
  // 处理从寄存器读取内容（粘贴或输入）
  private async handleRegisterRead(index: number, operation: RegisterOperation): Promise<void> {
    const content = this.clipRegStore.getFromRegister(index);
    if (!content) {
      Toast.fail(`寄存器${index + 1}为空`);
      return;
    }
    
    if (operation === RegisterOperation.PASTE) {
      await writeText(content);
      await invoke('paste_text');
      Toast.success(`已粘贴寄存器${index + 1}的内容`);
    } else {
      await invoke('type_text', { text: content });
      Toast.success(`已输入寄存器${index + 1}的内容`);
    }
  }
  
  // 处理保存内容到寄存器
  private async handleRegisterSave(index: number): Promise<void> {
    const clipboardText = await readText();
    if (!clipboardText) {
      Toast.fail('剪切板为空');
      return;
    }
    
    // 保存到本地寄存器
    this.clipRegStore.saveToRegister(index, clipboardText);
    Toast.success(`已保存到寄存器${index + 1}`);
    
    // 如果启用了同步，发送到其他设备
    if (this.clipRegStore.syncEnabled) {
      try {
        SocketService.sendMessage('text', clipboardText, index);
        console.log(`已同步寄存器${index + 1}内容到其他设备`);
      } catch (error) {
        console.error('同步剪切板寄存器失败:', error);
        Toast.fail('同步失败');
      }
    }
  }

  // 生成所有寄存器热键配置
  private generateRegisterConfigs(): RegisterConfig[] {
    const configs: RegisterConfig[] = [];
    
    // 获取用户设置的修饰键
    const modifier = this.settingsStore.hotkeyClipRegModifier;
    
    // 修饰键+(1-5) (粘贴操作)
    for (let i = 0; i < this.REGISTER_COUNT; i++) {
      configs.push({
        shortcut: `${modifier}+${i + 1}`,
        operation: RegisterOperation.PASTE,
        index: i
      });
    }
    
    // 修饰键+(6-0) (保存操作)
    this.SAVE_KEYS.forEach((key, i) => {
      configs.push({
        shortcut: `${modifier}+${key}`,
        operation: RegisterOperation.SAVE,
        index: i
      });
    });
    
    // Ctrl+Shift+(1-5) (模拟输入操作，固定不可修改)
    for (let i = 0; i < this.REGISTER_COUNT; i++) {
      configs.push({
        shortcut: `Control+Shift+${i + 1}`,
        operation: RegisterOperation.TYPE,
        index: i
      });
    }
    
    return configs;
  }

  // 初始化剪切板寄存器热键
  private async initClipRegHotkeys(): Promise<void> {
    if (!this.isTauriEnv || !this.clipRegStore.enabled) {
      console.log('剪切板寄存器功能已禁用或非Tauri环境，跳过热键注册');
      return;
    }
    
    try {
      const configs = this.generateRegisterConfigs();
      
      // 注册所有热键
      await Promise.all(configs.map(config => 
        this.registerShortcut(
          config.shortcut, 
          this.createRegisterCallback(config.index, config.operation)
        )
      ));
      
      console.log('剪切板寄存器热键注册成功');
    } catch (error) {
      console.error('注册剪切板寄存器热键失败:', error);
    }
  }
  
  // 设置剪切板寄存器功能状态
  async setClipRegEnabled(enabled: boolean): Promise<void> {
    if (!this.isTauriEnv) return;
    this.clipRegStore.setEnabled(enabled);
    
    if (!enabled) {
      await this.unregisterClipRegHotkeys();
    } else {
      await this.initClipRegHotkeys();
    }
  }
  
  // 注销所有剪切板寄存器热键
  private async unregisterClipRegHotkeys(): Promise<void> {
    if (!this.isTauriEnv) return;
    
    try {
      const configs = this.generateRegisterConfigs();
      const shortcuts = configs.map(config => config.shortcut);
      
      // 并行注销所有热键
      await Promise.all(shortcuts.map(shortcut => this.unregisterShortcut(shortcut)));
      
      console.log('已注销所有剪切板寄存器热键');
    } catch (error) {
      console.error('注销剪切板寄存器热键失败:', error);
    }
  }

  // 设置剪切板寄存器同步功能状态
  async setClipRegSyncEnabled(enabled: boolean): Promise<void> {
    if (!this.isTauriEnv) return;
    this.clipRegStore.setSyncEnabled(enabled);
  }

  // 设置剪切板寄存器修饰键
  async setClipRegModifier(newModifier: string): Promise<boolean> {
    return this.inTauriOrFalse(async () => {
      // 先注销现有的热键
      await this.unregisterClipRegHotkeys();
      
      // 更新设置
      this.settingsStore.setHotkeyClipRegModifier(newModifier);
      
      // 重新注册热键
      if (this.clipRegStore.enabled) {
        await this.initClipRegHotkeys();
      }
      
      return true;
    });
  }
}

// 单例模式实现
let hotkeyServiceInstance: HotkeyService | null = null;

export function initializeHotkeyService(): HotkeyService {
  if (!hotkeyServiceInstance) {
    hotkeyServiceInstance = new HotkeyService();
  }
  return hotkeyServiceInstance;
}

export function getHotkeyService(): HotkeyService {
  if (!hotkeyServiceInstance) {
    throw new Error('HotkeyService 未初始化，需先调用 initializeHotkeyService 获取实例');
  }
  return hotkeyServiceInstance;
}

