import { Menu, MenuItemConstructorOptions } from 'electron';

const APP_MENU_LABEL = 'Warcraft Recorder';

export default class MenuBuilder {
  constructor() {}

  buildMenu(): Menu {
    const template = this.buildDefaultTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    return menu;
  }

  private buildDefaultTemplate(): MenuItemConstructorOptions[] {
    const developSubmenu: MenuItemConstructorOptions[] = [
      {
        label: 'Reload',
        accelerator: 'CommandOrControl+R',
        role: 'reload',
      },
      {
        label: 'Toggle Developer Tools',
        role: 'toggleDevTools',
        accelerator: 'CommandOrControl+Shift+I',
      },
      {
        label: 'Zoom In',
        accelerator: 'CommandOrControl+Plus',
        role: 'zoomIn',
        visible: false,
        enabled: true,
      },
      {
        label: 'Zoom In Fix',
        accelerator: 'CommandOrControl+=',
        role: 'zoomIn',
        visible: false,
        enabled: true,
      },
      {
        label: 'Zoom Out',
        accelerator: 'CommandOrControl+-',
        role: 'zoomOut',
        visible: false,
        enabled: true,
      },
      {
        label: 'Zoom Out',
        accelerator: 'CommandOrControl+0',
        role: 'resetZoom',
        visible: false,
        enabled: true,
      },
    ];

    const template: MenuItemConstructorOptions[] = [
      { label: 'View', submenu: developSubmenu, visible: false, enabled: true },
    ];

    if (process.platform === 'darwin') {
      template.unshift({
        label: APP_MENU_LABEL,
        submenu: [
          { label: `About ${APP_MENU_LABEL}`, role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { label: `Hide ${APP_MENU_LABEL}`, role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { label: `Quit ${APP_MENU_LABEL}`, role: 'quit' },
        ],
      });
    }

    return template;
  }
}
