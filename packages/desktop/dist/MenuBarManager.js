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
const POPOVER_WIDTH = 360;
const POPOVER_HEIGHT = 500;
const MIN_POPOVER_HEIGHT = 220;
const POPOVER_MARGIN = 12;
const POPOVER_RESIZE_PADDING = 24;
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
            backgroundColor: '#101a27',
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
        const sunrisePrayer = prayerTimes.prayers.find((prayer) => prayer.name === 'Sunrise') ?? null;
        const schedule = visiblePrayers.map((prayer) => {
            const isNext = nextPrayer?.name === prayer.name;
            const occurrence = shared_1.PrayerTimeCalculator.getOccurrenceForDate(prayer, reference);
            const diff = occurrence.getTime() - reference.getTime();
            const isPast = diff < 0 && !isNext;
            const relative = this.formatRelativeLabel(diff, isNext, isPast, remainingLabel);
            const status = isNext ? 'Next' : isPast ? 'Completed' : 'Upcoming';
            const stateClass = isNext ? 'next' : isPast ? 'past' : 'upcoming';
            const secondaryLine = prayer.name === 'Fajr' && sunrisePrayer
                ? `<span class="pill-secondary">Sunrise ${sunrisePrayer.time}</span>`
                : '';
            return `
        <div class="prayer-card ${stateClass}">
          <div class="prayer-pill">
            <span class="pill-name">${prayer.name}</span>
            <span class="pill-status">${status}</span>
          </div>
          <div class="pill-time">
            ${isNext
                ? `<span class="pill-clock muted">${nextPrayer?.time}</span>`
                : `<span class="pill-clock">${prayer.time}</span>`}
            ${secondaryLine}
            <span class="pill-relative">${relative}</span>
          </div>
        </div>
      `;
        });
        const nextBlock = nextPrayer
            ? `
        <div class="next-card">
          <div class="next-label">Next Prayer</div>
          <div class="next-name">${nextPrayer.name}</div>
          <div class="next-time">${nextPrayer.time}</div>
          <div class="next-countdown">${remainingLabel === 'Now' ? 'Starting now' : remainingLabel ? `in ${remainingLabel}` : ''}</div>
        </div>
      `
            : `
        <div class="next-card idle">
          <div class="next-label">All Set</div>
          <div class="next-name">All prayers completed</div>
        </div>
      `;
        return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
    <title>Prayer Menu</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html {
        height: 100%;
      }
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: linear-gradient(160deg, #091421 0%, #14263a 55%, #0a1c2c 100%);
        color: #e2e8f0;
      }

      .tray-viewport {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        scrollbar-gutter: stable;
      }

      .tray-shell {
        width: 100%;
        padding: 0.8rem 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        justify-content: flex-start;
      }

      .tray-viewport::-webkit-scrollbar {
        width: 0.34rem;
      }

      .tray-viewport::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.35);
        border-radius: 999px;
      }

      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(226, 232, 240, 0.58);
      }

      .head span:nth-child(2) {
        color: rgba(226, 232, 240, 0.45);
      }

      .next-card {
        padding: 0.7rem 0.78rem;
        border-radius: 0.78rem;
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(37, 99, 235, 0.3) 100%);
        border: 1px solid rgba(148, 163, 184, 0.2);
        display: grid;
        gap: 0.28rem;
        justify-items: center;
        text-align: center;
        box-shadow: 0 0.9rem 2rem rgba(8, 20, 31, 0.26);
      }

      .next-card.idle {
        background: rgba(13, 24, 35, 0.75);
      }

      .next-label {
        font-size: 0.58rem;
        letter-spacing: 0.13em;
        text-transform: uppercase;
        color: rgba(226, 232, 240, 0.64);
      }

      .next-name {
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: 0.05em;
      }

      .next-time {
        font-size: 1.32rem;
        font-weight: 600;
      }

      .next-countdown {
        font-size: 0.7rem;
        color: rgba(226, 232, 240, 0.78);
        letter-spacing: 0.03em;
      }

      .schedule {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.45rem;
      }

      .prayer-card {
        padding: 0.55rem 0.5rem;
        border-radius: 0.68rem;
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(12, 21, 34, 0.68);
        box-shadow: 0 0.65rem 1.3rem rgba(5, 12, 20, 0.22);
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 0.38rem;
      }

      .prayer-card.next {
        border-color: rgba(96, 165, 250, 0.42);
        background: linear-gradient(135deg, rgba(96, 165, 250, 0.22), rgba(37, 99, 235, 0.3));
      }

      .prayer-card.past {
        opacity: 0.7;
      }

      .prayer-pill {
        display: flex;
        flex-direction: column;
        gap: 0.18rem;
      }

      .pill-name {
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .pill-status {
        font-size: 0.52rem;
        letter-spacing: 0.11em;
        text-transform: uppercase;
        color: rgba(226, 232, 240, 0.6);
      }

      .pill-time {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.18rem;
        font-variant-numeric: tabular-nums;
      }

      .pill-clock {
        font-size: 0.82rem;
        font-weight: 600;
      }

      .pill-secondary {
        font-size: 0.54rem;
        color: rgba(191, 219, 254, 0.72);
        letter-spacing: 0.04em;
      }

      .pill-clock.muted {
        color: rgba(226, 232, 240, 0.4);
      }

      .pill-relative {
        font-size: 0.58rem;
        color: rgba(226, 232, 240, 0.7);
        letter-spacing: 0.04em;
      }

      .muted {
        font-size: 0.6rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(226, 232, 240, 0.5);
      }

      a {
        color: inherit;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="tray-viewport">
      <div class="tray-shell">
        <div class="head">
          <span>${prayerTimes.date}</span>
          <span>${prayerTimes.hijriDate ?? ''}</span>
        </div>
        ${nextBlock}
        <div class="muted">Today's schedule</div>
        <div class="schedule">
          ${schedule.join('')}
        </div>
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