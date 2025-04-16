import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useConnectionStore = defineStore('connection', () => {
  const isConnected = ref(false);
  const isConnectingAttempt = ref(false);
  const room = ref(localStorage.getItem('room') || '');
  const userId = ref(localStorage.getItem('userId') || '');
  const serverAddress = ref(localStorage.getItem('serverAddress') || '');
  const serverPort = ref(localStorage.getItem('serverPort') || '8989');
  const protocol = ref(localStorage.getItem('protocol') || 'https');

  const setConnectionStatus = (status: boolean) => {
    isConnected.value = status;
  };

  const setConnectingAttempt = (status: boolean) => {
    isConnectingAttempt.value = status;
  };

  const setRoom = (roomName: string) => {
    room.value = roomName;
    localStorage.setItem('room', roomName);
  };

  const setUserId = (id: string) => {
    userId.value = id;
    localStorage.setItem('userId', id);
  };

  const setServerAddress = (address: string) => {
    serverAddress.value = address;
    localStorage.setItem('serverAddress', address);
  };

  const setServerPort = (port: string) => {
    serverPort.value = port;
    localStorage.setItem('serverPort', port);
  };

  const setProtocol = (proto: string) => {
    protocol.value = proto;
    localStorage.setItem('protocol', proto);
  };

  return {
    isConnected,
    isConnectingAttempt,
    room,
    userId,
    serverAddress,
    serverPort,
    protocol,
    setConnectionStatus,
    setConnectingAttempt,
    setRoom,
    setUserId,
    setServerAddress,
    setServerPort,
    setProtocol,
  };
}); 