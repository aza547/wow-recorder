import { Menu, MenuItemConstructorOptions } from 'electron';

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
    return [
      { label: 'View', submenu: developSubmenu, visible: false, enabled: true },
    ];
  }
}
