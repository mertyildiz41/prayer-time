"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuBarManager = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const shared_1 = require("@prayer-time/shared");
const TRAY_REFRESH_INTERVAL_MS = 60 * 1000;
const POPOVER_WIDTH = 380;
const POPOVER_HEIGHT = 600;
const MIN_POPOVER_HEIGHT = 300;
const POPOVER_MARGIN = 12;
const POPOVER_RESIZE_PADDING = 32;
const MENU_PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
class MenuBarManager {
    constructor(options = {}) {
        this.options = options;
        this.tray = null;
        this.latestPrayerTimes = null;
        this.popoverWindow = null;
        this.lastPopoverHtml = null;
        this.contextMenu = null;
        this.refreshTimer = null;
        this.preferredPopoverHeight = POPOVER_HEIGHT;
    }
    update(prayerTimes) {
        this.latestPrayerTimes = prayerTimes;
        if (!this.tray) {
            this.initializeTray();
        }
        if (!this.tray) {
            return;
        }
        this.refreshTrayDisplay();
        this.ensureRefreshTimer();
    }
    hidePopover() {
        if (this.popoverWindow?.isVisible()) {
            this.popoverWindow.hide();
        }
    }
    resizePopover(contentHeight) {
        const desiredHeight = Math.max(MIN_POPOVER_HEIGHT, Math.ceil(contentHeight) + POPOVER_RESIZE_PADDING);
        if (Math.abs(desiredHeight - this.preferredPopoverHeight) < 2) {
            return;
        }
        this.preferredPopoverHeight = desiredHeight;
        if (!this.tray || !this.popoverWindow || this.popoverWindow.isDestroyed()) {
            return;
        }
        this.positionPopover(this.popoverWindow, this.tray.getBounds());
    }
    destroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.tray?.destroy();
        this.tray = null;
        this.contextMenu = null;
        this.latestPrayerTimes = null;
        this.hidePopover();
        this.popoverWindow?.destroy();
        this.popoverWindow = null;
        this.lastPopoverHtml = null;
    }
    refreshTrayDisplay() {
        if (!this.tray || !this.latestPrayerTimes) {
            return;
        }
        const reference = new Date();
        const visiblePrayers = this.getMenuPrayers(this.latestPrayerTimes.prayers);
        const nextPrayer = shared_1.PrayerTimeCalculator.getNextPrayerTime(visiblePrayers, reference);
        const remainingLabel = nextPrayer
            ? this.formatTimeRemaining(shared_1.PrayerTimeCalculator.getTimeUntilPrayer(nextPrayer, reference))
            : null;
        if (nextPrayer && remainingLabel) {
            this.tray.setToolTip(`Next: ${nextPrayer.name} at ${nextPrayer.time} (${remainingLabel})`);
        }
        else {
            this.tray.setToolTip('Salah Time');
        }
        if (process.platform === 'darwin') {
            const title = nextPrayer && remainingLabel ? `${nextPrayer.name} ${remainingLabel}` : 'Salah Time';
            this.tray.setTitle(title);
        }
        const popoverHtml = this.buildPopoverHtml(this.latestPrayerTimes, reference, nextPrayer ?? null, remainingLabel);
        this.lastPopoverHtml = popoverHtml;
        if (this.popoverWindow) {
            this.loadPopoverHtml(popoverHtml);
        }
    }
    ensureRefreshTimer() {
        if (this.refreshTimer) {
            return;
        }
        this.refreshTimer = setInterval(() => {
            this.refreshTrayDisplay();
        }, TRAY_REFRESH_INTERVAL_MS);
    }
    initializeTray() {
        const icon = electron_1.nativeImage.createEmpty();
        icon.setTemplateImage(true);
        this.tray = new electron_1.Tray(icon);
        this.tray.setIgnoreDoubleClickEvents(true);
        this.tray.on('click', (_event, bounds) => {
            this.togglePopover(bounds);
        });
        this.tray.on('right-click', () => {
            this.hidePopover();
            this.showContextMenu();
        });
        this.tray.on('mouse-leave', () => {
            if (!this.popoverWindow?.isFocused()) {
                this.hidePopover();
            }
        });
        if (this.latestPrayerTimes) {
            this.update(this.latestPrayerTimes);
        }
    }
    showContextMenu() {
        if (!this.tray) {
            return;
        }
        if (!this.contextMenu) {
            this.contextMenu = electron_1.Menu.buildFromTemplate([
                {
                    label: 'Show App',
                    click: () => {
                        this.options.onShowApp?.();
                    },
                },
                {
                    label: 'Quit',
                    click: () => {
                        electron_1.app.quit();
                    },
                },
            ]);
        }
        this.tray.popUpContextMenu(this.contextMenu);
    }
    ensurePopoverWindow() {
        if (this.popoverWindow) {
            return this.popoverWindow;
        }
        this.popoverWindow = new electron_1.BrowserWindow({
            width: POPOVER_WIDTH,
            height: POPOVER_HEIGHT,
            show: false,
            frame: false,
            resizable: false,
            movable: false,
            fullscreenable: false,
            skipTaskbar: true,
            backgroundColor: '#0F1115',
            alwaysOnTop: true,
            focusable: true,
            webPreferences: {
                preload: path_1.default.join(__dirname, 'menu-preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
        this.popoverWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        this.popoverWindow.on('blur', () => {
            this.hidePopover();
        });
        this.popoverWindow.on('closed', () => {
            this.popoverWindow = null;
        });
        if (this.lastPopoverHtml) {
            this.loadPopoverHtml(this.lastPopoverHtml);
        }
        return this.popoverWindow;
    }
    togglePopover(triggerBounds) {
        if (!this.tray) {
            return;
        }
        const window = this.ensurePopoverWindow();
        if (window.isVisible()) {
            this.hidePopover();
            return;
        }
        this.positionPopover(window, triggerBounds ?? this.tray.getBounds());
        window.show();
        window.focus();
    }
    positionPopover(window, trayBounds) {
        const targetDisplay = electron_1.screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
        const workArea = targetDisplay.workArea;
        const width = POPOVER_WIDTH;
        const availableHeight = Math.max(240, workArea.height - POPOVER_MARGIN * 2);
        const desiredHeight = Math.max(MIN_POPOVER_HEIGHT, this.preferredPopoverHeight);
        const height = Math.min(desiredHeight, availableHeight);
        let x = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2);
        let y;
        if (process.platform === 'darwin') {
            y = Math.round(trayBounds.y + trayBounds.height + 4);
        }
        else {
            y = Math.round(trayBounds.y - height - 4);
        }
        x = Math.min(Math.max(workArea.x + POPOVER_MARGIN, x), workArea.x + workArea.width - width - POPOVER_MARGIN);
        y = Math.min(Math.max(workArea.y + POPOVER_MARGIN, y), workArea.y + workArea.height - height - POPOVER_MARGIN);
        window.setBounds({ x, y, width, height }, false);
        window.setPosition(x, y, false);
    }
    loadPopoverHtml(html) {
        if (!this.popoverWindow) {
            return;
        }
        const encoded = Buffer.from(html, 'utf8').toString('base64');
        this.popoverWindow.loadURL(`data:text/html;base64,${encoded}`);
    }
    buildPopoverHtml(prayerTimes, reference, nextPrayer, remainingLabel) {
        const visiblePrayers = this.getMenuPrayers(prayerTimes.prayers);
        const formattedDate = reference.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
        const getPrayerIcon = (name, isActive) => {
            const color = isActive ? '#007AFF' : '#8E8E93';
            switch (name) {
                case 'Fajr':
                    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M4.93 19.07l1.41-1.41M12 22v-2M17.66 19.07l-1.41-1.41M22 12h-2M17.66 4.93l-1.41 1.41"></path></svg>`;
                case 'Dhuhr':
                    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
                case 'Asr':
                    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
                case 'Maghrib':
                    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${isActive ? '#007AFF' : '#8E8E93'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;
                case 'Isha':
                    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;
                default:
                    return '';
            }
        };
        const getPrayerDescription = (name) => {
            switch (name) {
                case 'Fajr': return 'Dawn time in your area';
                case 'Dhuhr': return 'Noon time in your area';
                case 'Asr': return 'Afternoon time in your area';
                case 'Maghrib': return 'Sunset time in your area';
                case 'Isha': return 'Night time in your area';
                default: return 'Prayer time in your area';
            }
        };
        const scheduleItems = visiblePrayers.map((prayer) => {
            const isNext = nextPrayer?.name === prayer.name;
            const icon = getPrayerIcon(prayer.name, isNext);
            const itemClass = isNext ? 'schedule-item active' : 'schedule-item';
            return `
        <div class="${itemClass}">
          <div class="prayer-info">
            <span class="prayer-icon">${icon}</span>
            <span class="prayer-name">${prayer.name}</span>
          </div>
          <span class="prayer-time">${prayer.time}</span>
        </div>
      `;
        });
        const countdownText = remainingLabel ? (remainingLabel === 'Now' ? '00:00' : remainingLabel.includes('h') ? remainingLabel : `00:${remainingLabel.replace('m', '').padStart(2, '0')}`) : '--:--';
        return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
    <title>Prayer Manager</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg-color: #0F1115;
        --card-bg: #1A1C20;
        --text-primary: #FFFFFF;
        --text-secondary: #8E8E93;
        --accent-blue: #007AFF;
        --accent-blue-soft: rgba(0, 122, 255, 0.1);
        --glow-blue: rgba(0, 122, 255, 0.3);
      }
      
      * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
      
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background-color: var(--bg-color);
        color: var(--text-primary);
        overflow: hidden;
      }

      .container {
        width: 100%;
        display: flex;
        flex-direction: column;
        padding: 20px;
        gap: 24px;
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .app-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .app-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #2C3E50 0%, #000000 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,0.1);
      }

      .app-title {
        font-weight: 600;
        font-size: 16px;
      }

      .close-btn {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
      }

      .close-btn:hover { color: var(--text-primary); }

      .greeting-section .date {
        font-size: 14px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .greeting-section h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.5px;
      }

      .next-prayer-card {
        background-color: var(--card-bg);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        border: 1px solid rgba(255,255,255,0.05);
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }

      .next-prayer-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .next-prayer-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .next-prayer-info .label {
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-blue);
        letter-spacing: 0.5px;
      }

      .next-prayer-info .prayer-name {
        font-size: 32px;
        font-weight: 700;
        margin: 0;
      }

      .next-prayer-info .prayer-desc {
        font-size: 13px;
        color: var(--text-secondary);
      }

      .countdown-pill {
        background-color: rgba(255,255,255,0.05);
        padding: 8px 12px;
        border-radius: 10px;
        text-align: center;
        min-width: 80px;
      }

      .countdown-pill .time {
        display: block;
        font-size: 20px;
        font-weight: 700;
      }

      .countdown-pill .unit {
        display: block;
        font-size: 10px;
        color: var(--text-secondary);
        text-transform: uppercase;
        font-weight: 600;
      }

      .reminder-btn {
        background-color: var(--accent-blue);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 12px;
        font-size: 15px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: transform 0.1s, background-color 0.2s;
      }

      .reminder-btn:hover { background-color: #0066D6; }
      .reminder-btn:active { transform: scale(0.98); }

      .schedule-section h3 {
        font-size: 15px;
        font-weight: 600;
        margin: 0 0 16px 0;
      }

      .schedule-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .schedule-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-radius: 12px;
        transition: background-color 0.2s;
        border: 1px solid transparent;
      }

      .schedule-item.active {
        background-color: var(--accent-blue-soft);
        border: 1px solid rgba(0, 122, 255, 0.2);
        box-shadow: 0 0 15px var(--glow-blue);
      }

      .schedule-item .prayer-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .schedule-item .prayer-name {
        font-size: 15px;
        font-weight: 500;
      }

      .schedule-item.active .prayer-name {
        color: var(--text-primary);
        font-weight: 600;
      }

      .schedule-item .prayer-time {
        font-size: 15px;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
      }

      .schedule-item.active .prayer-time {
        color: var(--accent-blue);
        font-weight: 600;
      }

      footer {
        margin-top: 8px;
        display: flex;
        justify-content: center;
      }

      .calendar-link {
        background: none;
        border: none;
        color: var(--accent-blue);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px;
      }

      .calendar-link:hover { text-decoration: underline; }

      .tray-shell { width: 100%; }
    </style>
  </head>
  <body>
    <div class="tray-shell">
      <div class="container">
        <header>
          <div class="app-info">
            <div class="app-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18"></path>
                <path d="M7 21v-4"></path>
                <path d="M17 21v-4"></path>
                <path d="M10 21V10l2-2 2 2v11"></path>
                <path d="M12 4V2"></path>
              </svg>
            </div>
            <span class="app-title">Prayer Manager</span>
          </div>
          <button class="close-btn" onclick="invokeAction('hidePopover')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </header>

        <main>
          <div class="greeting-section">
            <div class="date">${formattedDate}</div>
            <h1>As-salaam Alaikum</h1>
          </div>

          <div class="next-prayer-card">
            <div class="next-prayer-header">
              <div class="next-prayer-info">
                <span class="label">NEXT PRAYER</span>
                <h2 class="prayer-name">${nextPrayer?.name ?? 'All Done'}</h2>
                <span class="prayer-desc">${getPrayerDescription(nextPrayer?.name ?? '')}</span>
              </div>
              <div class="countdown-pill">
                <span class="time">${countdownText}</span>
                <span class="unit">min left</span>
              </div>
            </div>
            <button class="reminder-btn" onclick="invokeAction('manageNotifications')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              Set Reminder
            </button>
          </div>

          <section class="schedule-section">
            <h3>Daily Schedule</h3>
            <div class="schedule-list">
              ${scheduleItems.join('')}
            </div>
          </section>

          <footer>
            <button class="calendar-link" onclick="invokeAction('openApp')">
              View Monthly Calendar
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </footer>
        </main>
      </div>
    </div>
    <script>
      const invokeAction = (action) => {
        if (window.tray && typeof window.tray[action] === 'function') {
          window.tray[action]();
        }
      };

      let lastRequestedHeight = 0;

      const requestPopoverResize = () => {
        const shell = document.querySelector('.tray-shell');
        if (!shell || !window.tray || typeof window.tray.resizePopover !== 'function') {
          return;
        }

        const shellRect = shell.getBoundingClientRect();
        const nextHeight = Math.ceil(shellRect.height);
        if (Math.abs(nextHeight - lastRequestedHeight) < 2) {
          return;
        }

        lastRequestedHeight = nextHeight;
        window.tray.resizePopover(nextHeight);
      };

      let resizeFrame = 0;
      const queuePopoverResize = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(requestPopoverResize);
      };

      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          invokeAction('hidePopover');
        }
      });

      window.addEventListener('load', queuePopoverResize);
      window.addEventListener('resize', queuePopoverResize);
      queuePopoverResize();
      setTimeout(queuePopoverResize, 60);

      if ('ResizeObserver' in window) {
        const shell = document.querySelector('.tray-shell');
        if (shell) {
          const observer = new ResizeObserver(() => queuePopoverResize());
          observer.observe(shell);
        }
      }
    </script>
  </body>
</html>`;
    }
    getMenuPrayers(prayers) {
        return prayers.filter((prayer) => MENU_PRAYER_NAMES.includes(prayer.name));
    }
    formatRelativeLabel(diff, isNext, isPast, remainingLabel) {
        if (isNext) {
            if (!remainingLabel) {
                return 'Soon';
            }
            return remainingLabel === 'Now' ? 'Starting now' : `in ${remainingLabel}`;
        }
        if (isPast) {
            const ago = this.formatTimeRemaining(Math.abs(diff));
            return ago === 'Now' ? 'Moments ago' : `${ago} ago`;
        }
        const ahead = this.formatTimeRemaining(diff);
        return ahead === 'Now' ? 'Moments away' : `in ${ahead}`;
    }
    formatTimeRemaining(milliseconds) {
        if (milliseconds <= 0) {
            return 'Now';
        }
        const totalMinutes = Math.max(1, Math.round(milliseconds / 60000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0 && minutes > 0) {
            return `${hours}h ${minutes}m`;
        }
        if (hours > 0) {
            return `${hours}h`;
        }
        return `${minutes}m`;
    }
}
exports.MenuBarManager = MenuBarManager;
//# sourceMappingURL=MenuBarManager.js.map