import { io, Socket } from 'socket.io-client';
import { useChatStore, Message } from '../stores/useChatStore';
import { useConnectionStore } from '../stores/useConnectionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useClipRegStore } from '../stores/useClipRegStore';
import ClipboardService from './ClipboardService';
import { Toast } from 'vant';
import { isTauri } from '@tauri-apps/api/core';

enum MessageType {
  TEXT = 'text',
  IMAGE = 'image'
}

enum EventType {
  // Socket.IO 内置事件
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECT_ERROR = 'connect_error',
  RECONNECT_ATTEMPT = 'reconnect_attempt',
  RECONNECT_FAILED = 'reconnect_failed',
  RECONNECT_SUCCESS = 'reconnect',
  
  // 注册相关事件
  REGISTER = 'register',
  REGISTRATION_ERROR = 'registrationError',
  
  // 消息相关事件
  MESSAGE_BROADCAST = 'broadcast',    // 接收广播消息
  SEND_MESSAGE = 'sendMessage',       // 发送消息
  MESSAGE_ERROR = 'messageError',     // 消息处理错误
  
  // 历史消息相关事件
  REQUEST_HISTORY = 'requestHistory',     // 请求历史消息
  HISTORY_RESPONSE = 'historyResponse',   // 历史消息响应
  HISTORY_ERROR = 'historyError'          // 历史消息错误
}

const SOCKET_CONFIG = {
  autoConnect: false,
  transports: ['websocket'], 
  reconnectionAttempts: Infinity,
  reconnectionDelay: 3000,
  reconnectionDelayMax: 10000,
  pingTimeout: 20000,
  timeout: 20000,
};

const MAX_CLIP_REG_INDEX = 4;

class SocketService {
  private socket: Socket | null = null;
  private room: string = '';
  private userId: string = '';
  
  private get chatStore() {
    return useChatStore();
  }
  
  private get connectionStore() {
    return useConnectionStore();
  }
  
  private get settingsStore() {
    return useSettingsStore();
  }
  
  private get clipRegStore() {
    return useClipRegStore();
  }

  /**
   * 连接到服务器并加入房间
   * @param room 房间ID
   * @param userId 用户ID
   * @param serverUrl 服务器URL
   */
  joinRoom(room: string, userId: string, serverUrl: string): void {
    if (room === '' || userId === '') {
      Toast.fail('连接失败：房间ID或用户ID未设置');
      return;
    }
    
    if (this.connectionStore.isConnectingAttempt || this.connectionStore.isConnected) {
        return; 
    }

    if (this.room !== room) {
      this.chatStore.clearMessages();
    }
    this.room = room;
    this.userId = userId;

    this.connectionStore.setConnectingAttempt(true);
    this.connect(serverUrl);
  }

  /**
   * 建立WebSocket连接
   * @param url 服务器URL
   */
  private connect(url: string): void {
    if (this.socket?.connected) {
        this.connectionStore.setConnectingAttempt(false); 
        return;
    }
    
    if (this.socket && !this.socket.connected && !this.connectionStore.isConnectingAttempt) {
        this.socket.disconnect();
        this.socket = null;
    }
    
    if (this.connectionStore.isConnectingAttempt && this.socket) {
      return;
    }

    this.socket = io(url, SOCKET_CONFIG);
    this.setupSocketListeners();
    
    this.socket.connect();
  }

  private setupSocketListeners(): void {
    if (!this.socket) {
      return;
    }

    // Socket.IO 内置事件
    this.socket.on(EventType.CONNECT, () => {
      this.updateConnectionStatus(true); 

      // 用户主动连接时显示提示，自动重连不显示
      if (this.connectionStore.isConnectingAttempt) {
        Toast.success('连接成功'); 
      }

      this.socket!.emit(EventType.REGISTER, { room: this.room, userId: this.userId });
      this.requestHistory(this.chatStore.lastMessageId + 1);
    });
    
    this.socket.on(EventType.DISCONNECT, (reason: string) => {
      this.handleDisconnect(reason); 
    });
    
    this.socket.on(EventType.CONNECT_ERROR, (error: Error) => {
      if (this.connectionStore.isConnectingAttempt) {
        Toast.fail(`连接错误: ${error.message}`); 
      }
      this.handleDisconnect(`连接错误: ${error.message}`);
    });
    
    this.socket.on(EventType.RECONNECT_ATTEMPT, (attemptNumber: number) => {
      console.log(`[SocketService] Event received: '${EventType.RECONNECT_ATTEMPT}', Attempt: ${attemptNumber}`);
    });
    
    this.socket.on(EventType.RECONNECT_SUCCESS, (attemptNumber: number) => {
      console.log(`[SocketService] Event received: '${EventType.RECONNECT_SUCCESS}', Attempt: ${attemptNumber}`);
      Toast.success('重新连接成功');
    });
    
    this.socket.on(EventType.RECONNECT_FAILED, () => {
      console.error(`[SocketService] Event received: '${EventType.RECONNECT_FAILED}'`);
      this.connectionStore.setConnectionStatus(false); 
      this.connectionStore.setConnectingAttempt(false); 
      Toast.fail('重连失败，请检查网络或服务器');
    });
    
    // 注册相关事件
    this.socket.on(EventType.REGISTRATION_ERROR, (data: { message: string }) => {
      console.error(`[SocketService] Event received: '${EventType.REGISTRATION_ERROR}', Message: ${data.message}`);
      Toast.fail(`注册失败: ${data.message}`);
      this.disconnect(); 
    });
    
    // 消息相关事件
    this.socket.on(EventType.MESSAGE_BROADCAST, async (data: Message) => {
      try {
        this.chatStore.addMessage(data);

        if (isTauri()) {
          await this.tryAutoCopy(data);
          await this.handleClipRegMessage(data);
        }
      } catch (error) {
        console.error('[SocketService] Error handling broadcast message:', error);
      }
    });

    this.socket.on(EventType.MESSAGE_ERROR, (data: { message: string }) => {
      console.error(`[SocketService] Event received: '${EventType.MESSAGE_ERROR}', Message: ${data.message}`);
      Toast.fail(`消息处理错误: ${data.message}`);
    });
    
    // 历史消息相关事件
    this.socket.on(EventType.HISTORY_RESPONSE, (historyMessages: Message[]) => {
      console.log(`[SocketService] Event received: '${EventType.HISTORY_RESPONSE}', Count: ${historyMessages.length}`);
      try {
        Toast.clear();
        historyMessages.forEach(message => {
          if (message.id && message.id <= this.chatStore.lastMessageId) {
            return;
          }
          this.chatStore.addMessage(message);
        });
      } catch (error) {
        console.error('[SocketService] Error processing history response:', error);
        Toast.fail('加载历史消息失败');
      }
    });
    
    this.socket.on(EventType.HISTORY_ERROR, (data: { message: string }) => {
      console.error(`[SocketService] Event received: '${EventType.HISTORY_ERROR}', Message: ${data.message}`);
      Toast.clear();
      Toast.fail(`获取历史记录失败: ${data.message}`);
    });
  }

  private updateConnectionStatus(isConnected: boolean): void {
    console.log(`[SocketService] updateConnectionStatus called with isConnected=${isConnected}`);
    const oldConnectingAttempt = this.connectionStore.isConnectingAttempt;
    console.log(`[SocketService] Setting isConnectingAttempt = false (was ${oldConnectingAttempt})`);
    this.connectionStore.setConnectingAttempt(false);
    console.log(`[SocketService] Setting isConnected = ${isConnected}`);
    this.connectionStore.setConnectionStatus(isConnected);

    if (isConnected) {
      console.log(`[SocketService] Status updated: Connected. Socket ID: ${this.socket?.id}`);
    } else {
        console.log('[SocketService] Status updated: Disconnected or connection failed.');
    }
  }

  private async handleClipRegMessage(data: Message): Promise<void> {
    if (data.type !== MessageType.TEXT || data.clipReg === undefined || !this.clipRegStore.enabled) {
      return;
    }

    try {
      const registerIndex = data.clipReg;
      
      if (registerIndex >= 0 && registerIndex <= MAX_CLIP_REG_INDEX) {
        this.clipRegStore.saveToRegister(registerIndex, data.content);
      } else {
        console.warn(`[SocketService] Received invalid clip register index: ${registerIndex}`);
      }
    } catch (error) {
      console.error('[SocketService] Error handling clip register sync message:', error);
    }
  }

  private async tryAutoCopy(data: Message): Promise<void> {
    try {
      const shouldCopyText = data.type === MessageType.TEXT && this.settingsStore.autoCopyText;
      const shouldCopyImage = data.type === MessageType.IMAGE && this.settingsStore.autoCopyImage;
      
      if (shouldCopyText || shouldCopyImage) {
        await ClipboardService.copyMessage(data);
      }
    } catch (error) {
      console.error('[SocketService] Auto-copy failed:', error);
    }
  }

  private handleDisconnect(reason: string): void {
    console.log(`[SocketService] handleDisconnect called with reason: ${reason}`);
    const wasConnected = this.connectionStore.isConnected;
    const wasConnecting = this.connectionStore.isConnectingAttempt;

    this.updateConnectionStatus(false); 

    if (wasConnected && reason !== 'io client disconnect' && reason !== 'io server disconnect') {
       console.log('[SocketService] Connection unexpectedly lost. Socket.IO client will attempt auto-reconnect...');
    } else if (reason.startsWith('连接错误') || (reason !== 'io client disconnect' && reason !== 'io server disconnect' && wasConnecting)) {
       console.log(`[SocketService] Disconnect handled. Reason: ${reason}. Initial attempt was: ${wasConnecting}.`);
    } else if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        console.log('[SocketService] Disconnect handled due to explicit client/server request.');
    } else {
        console.log(`[SocketService] Disconnect processed. Reason: ${reason}`);
    }
  }

  sendMessage(type: MessageType | string, content: string, clipReg?: number): void {
    if (!this.socket?.connected) {
      console.error('[SocketService] Cannot send message: Not connected to the server.');
      Toast.fail('未连接到服务器，无法发送消息');
      return;
    }

    const message: Message = { 
      type: type as 'text' | 'image', 
      content, 
      userId: this.connectionStore.userId, 
      timestamp: new Date().toISOString(),
      ...(clipReg !== undefined && type === MessageType.TEXT ? { clipReg } : {})
    };
    
    this.socket.emit(EventType.SEND_MESSAGE, message);
  }

  disconnect(): void {
    if (!this.socket) {
      console.log('[SocketService] disconnect(): Socket is already null.');
      this.updateConnectionStatus(false); 
      return;
    }

    try {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.room = '';
      this.userId = '';

      const wasConnected = this.connectionStore.isConnected;
      this.updateConnectionStatus(false);
      if (wasConnected) {
         Toast.success('已断开连接'); 
      }
    } catch (error) {
      console.error('[SocketService] disconnect(): Error during disconnection:', error);
      this.updateConnectionStatus(false);
      this.socket = null; 
      Toast.fail('断开连接时出错');
    }
  }

  /**
   * 请求历史消息
   * @param fromId 起始ID，请求>=此ID的消息，默认为1表示所有消息
   */
  requestHistory(fromId: number = 1): void {
    if (!this.socket?.connected) {
      console.warn(`[SocketService] Cannot request history: Not connected.`);
      return;
    }
    if (!this.room) {
      console.warn(`[SocketService] Cannot request history: Room not set.`);
      return;
    }
    
    Toast.loading({
      message: '加载历史消息...',
      forbidClick: true,
    });
    
    this.socket.emit(EventType.REQUEST_HISTORY, {
      room: this.room,
      fromId: fromId
    });
  }
}

export default new SocketService();

