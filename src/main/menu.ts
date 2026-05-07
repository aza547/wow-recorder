import { app, Menu, MenuItemConstructorOptions } from 'electron';

export default class MenuBuilder {
  buildMenu(): Menu {
    const template =
      process.platform === 'darwin'
        ? this.buildMacTemplate()
        : this.buildDefaultTemplate();
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
        label: 'Zoom Out',
        accelerator: 'CommandOrControl+-',
        role: 'zoomOut',
        visible: false,
        enabled: true,
      },
      {
        label: 'Reset Zoom',
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

  private buildMacTemplate(): MenuItemConstructorOptions[] {
    return [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload', accelerator: 'Cmd+R' },
          { role: 'toggleDevTools', accelerator: 'Alt+Cmd+I' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
    ];
  }
}
