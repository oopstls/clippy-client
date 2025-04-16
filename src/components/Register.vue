<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <button class="close-icon" @click="close" aria-label="关闭">
        <font-awesome-icon :icon="['fas', 'xmark']" />
      </button>
      <h2>Connect</h2>
      
      <form @submit.prevent="handleConnect">
        <div class="form-group server-input-container">
          <div class="protocol-select">
            <select v-model="form.protocol" :disabled="isConnected || userIntentConnecting" class="protocol-dropdown">
              <option value="https">wss://</option>
              <option value="http" :disabled="isHttpsEnv" :title="isHttpsEnv ? '在HTTPS环境下必须使用WSS协议' : ''">ws://</option>
            </select>
          </div>
          <div class="server-input">
            <input 
              v-model="form.serverAddress" 
              :disabled="isConnected || userIntentConnecting"
              placeholder="Server Address (e.g., example.com)" 
              required
              @keyup.enter="handleConnect"
            />
          </div>
        </div>
        
        <div class="form-group">
          <input 
            v-model="form.room" 
            :disabled="isConnected || userIntentConnecting"
            placeholder="Room ID (Only include characters)" 
            required
            pattern="[A-Za-z0-9\-]+"
            @keyup.enter="handleConnect"
          />
        </div>
        <div class="form-group">
          <input 
            v-model="form.userId" 
            :disabled="isConnected || userIntentConnecting"
            placeholder="User ID (Only include characters)" 
            required
            pattern="[A-Za-z0-9\-]+"
            @keyup.enter="handleConnect"
          />
        </div>
        
        <div class="advanced-toggle" @click="toggleAdvanced">
          <span>Advanced Settings</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="dropdown-icon" :class="{ 'rotate-180': advancedOpen }" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </div>
        
        <div class="advanced-settings" v-show="advancedOpen">
          <div class="form-group">
            <input 
              v-model="form.customPort" 
              :disabled="isConnected || userIntentConnecting"
              placeholder="Custom Port (Leave blank for default)" 
              @keyup.enter="handleConnect"
              type="string"
              min="1"
              max="65535"
            />
          </div>
        </div>
        
        <div class="buttons">
          <button
            type="submit"
            :disabled="isConnected || userIntentConnecting"  
            :class="['connect-button', { disabled: isConnected || userIntentConnecting }]"
          >
            Connect
          </button>
          <button
            type="button"
            @click="handleDisconnect"
            :disabled="!isConnected || userIntentConnecting"
            :class="['disconnect-button', { disabled: !isConnected || userIntentConnecting, active: isConnected }]"
          >
            Disconnect
          </button>
        </div>
      </form>
    </div>

    <van-popup
      v-model:show="userIntentConnecting"
      :close-on-click-overlay="false"
      round
      position="center"
      style="padding: 2rem; width: 250px; text-align: center;"
    >
      <van-loading type="spinner" vertical color="#1989fa" text-size="14px">
        正在连接服务器...
      </van-loading>
      <van-button
        type="default"
        size="small"
        @click="handleCancelConnect"
        style="margin-top: 1.5rem; width: 100px;"
      >
        取消
      </van-button>
    </van-popup>

  </div>
</template>

<script setup lang="ts">
import { computed, reactive, onMounted, ref, watch } from 'vue';
import { useConnectionStore } from '../stores/useConnectionStore';
import SocketService from '../services/SocketService';
import { Toast } from 'vant';

interface FormState {
  serverAddress: string;
  customPort: string;
  room: string;
  userId: string;
  protocol: string;
}

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const connectionStore = useConnectionStore();
const advancedOpen = ref(false);
const userIntentConnecting = ref(false);

const isHttpsEnv = computed(() => typeof window !== 'undefined' && window.location.protocol === 'https:');
const isConnected = computed(() => connectionStore.isConnected);

watch(() => connectionStore.isConnected, (connected) => {
  if (connected) {
    userIntentConnecting.value = false;
  }
});

const form = reactive<FormState>({
  serverAddress: connectionStore.serverAddress || '',
  customPort: '',
  room: connectionStore.room || '',
  userId: connectionStore.userId || '',
  protocol: isHttpsEnv.value || !connectionStore.protocol ? 'https' : connectionStore.protocol
});

watch(() => form.protocol, (newProtocol) => {
  if (isHttpsEnv.value && newProtocol === 'http') {
    form.protocol = 'https';
    Toast('HTTPS环境下必须使用WSS协议');
  }
});

const getDefaultPort = (protocol: string): string => protocol === 'http' ? '8989' : '9898';

const toggleAdvanced = () => {
  advancedOpen.value = !advancedOpen.value;
};

const validateForm = (): boolean => {
  if (!form.serverAddress.trim()) {
    Toast.fail('请输入服务器地址');
    return false;
  }

  if (!form.room.trim() || !form.userId.trim()) {
    Toast.fail('请输入房间ID和用户ID');
    return false;
  }

  return true;
};

const getServerUrl = (): string => {
  const { protocol, serverAddress, customPort } = form;
  const portToUse = customPort.trim() || getDefaultPort(protocol);
  return `${protocol}://${serverAddress.trim()}:${portToUse}`;
};

const updateConnectionStore = () => {
  const { serverAddress, customPort, room, userId, protocol } = form;
  const portToUse = customPort.trim() || getDefaultPort(protocol);
  
  connectionStore.setServerAddress(serverAddress.trim());
  connectionStore.setServerPort(portToUse);
  connectionStore.setRoom(room.trim());
  connectionStore.setUserId(userId.trim());
  connectionStore.setProtocol(protocol);
};

const handleConnect = async () => {
  if (!validateForm()) return;

  updateConnectionStore();
  userIntentConnecting.value = true;

  try {
    SocketService.joinRoom(form.room.trim(), form.userId.trim(), getServerUrl());
  } catch (error) {
    console.error('发起连接调用时出错 (意外情况):', error);
    userIntentConnecting.value = false;
    connectionStore.setConnectingAttempt(false);
    Toast.fail('发起连接时出错，请检查设置');
  }
};

const handleCancelConnect = () => {
  console.log('用户取消连接');
  userIntentConnecting.value = false;
  SocketService.disconnect();
};

const handleDisconnect = async () => {
  userIntentConnecting.value = false;
  try {
    SocketService.disconnect();
  } catch (error) {
    console.error('断开连接时捕获到意外错误:', error);
  }
};

const close = () => emit('close');

onMounted(() => {
  const storedPort = connectionStore.serverPort;
  const defaultPorts = [getDefaultPort('http'), getDefaultPort('https')]; 
  
  if (storedPort && !defaultPorts.includes(storedPort)) {
    form.customPort = storedPort;
  }
  
  if (isHttpsEnv.value && form.protocol === 'http') {
    form.protocol = 'https';
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  position: relative;
  background-color: white;
  padding: 2rem;
  border-radius: 1.5rem;
  width: min(400px, 90%);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

.close-icon {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #555;
  transition: color 0.3s;
}

.close-icon:hover {
  color: #000;
}

h2 {
  margin: 0 0 1.25rem;
}

.form-group {
  margin-bottom: 1rem;
}

.server-input-container {
  display: flex;
  align-items: stretch;
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 0.75rem;
  overflow: hidden;
}

.protocol-select {
  width: 22%;
  min-width: 62px;
}

.protocol-dropdown {
  width: 100%;
  height: 100%;
  padding: 0.625rem;
  border: none;
  border-right: 1px solid #ccc;
  background-color: #f8f9fa;
  font-size: 0.875rem;
  cursor: pointer;
  color: #333;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 1em;
  padding-right: 1.5rem;
  box-sizing: border-box;
}

.protocol-dropdown:focus {
  outline: none;
}

.protocol-dropdown:disabled {
  background-color: #f0f0f0;
  color: #999;
  cursor: not-allowed;
}

.protocol-dropdown option[disabled] {
  color: #aaa;
  font-style: italic;
  background-color: #f8f8f8;
}

.server-input {
  flex: 1;
  display: flex;
}

.server-input input {
  width: 100%;
  height: 100%;
  padding: 0.625rem;
  border: none;
  font-size: 0.875rem;
  box-sizing: border-box;
}

input {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #ccc;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: #007bff;
}

input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.server-input-container input:disabled {
  border-radius: 0;
  border-top-right-radius: 0.75rem;
  border-bottom-right-radius: 0.75rem;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0.5rem auto;
  color: #666;
  font-size: 0.8rem;
  width: fit-content;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  transition: background-color 0.2s;
}

.advanced-toggle:hover {
  background-color: #f5f5f5;
}

.dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  margin-left: 0.25rem;
  transition: transform 0.2s ease;
}

.rotate-180 {
  transform: rotate(180deg);
}

.advanced-settings {
  margin-bottom: 1rem;
  padding: 0.5rem 0;
  border-radius: 0.75rem;
}

.buttons {
  display: flex;
  gap: 0.625rem;
  margin-top: 1.5rem;
}

button {
  flex: 1;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s;
}

.connect-button {
  background-color: #007bff;
  color: white;
}

.connect-button:hover:not(.disabled) {
  background-color: #0056b3;
}

.disconnect-button {
  background-color: #dc3545;
  color: white;
}

.disconnect-button:hover:not(.disabled) {
  background-color: #c82333;
}

.disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style>

