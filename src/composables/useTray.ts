import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';
import { Dialog } from 'vant';

export function useTray() {
  const showMainWindow = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.show();
    await appWindow.setFocus();
  };

  const handleCloseRequested = (event: any) => {
    event.preventDefault?.();
    Dialog.confirm({
      title: '提示',
      message: '选择窗口关闭方式',
      confirmButtonText: '直接退出',
      cancelButtonText: '最小化到托盘',
    })
      .then(() => {
        exit(0);
      })
      .catch(() => {
        getCurrentWindow().hide();
      });
  };

  const initTray = async () => {
    const menu = await Menu.new({
      items: [
        {
          id: 'quit',
          text: '退出',
          action: () => exit(0)
        },
      ],
    });

    return await TrayIcon.new({
      icon: await defaultWindowIcon() ?? undefined,
      menu,
      menuOnLeftClick: false,
      action: (event) => {
        if (event.type === 'Click' && event.button === 'Left') {
          showMainWindow();
        }
      },
    });
  };

  return {
    initTray,
    handleCloseRequested,
    showMainWindow
  };
}