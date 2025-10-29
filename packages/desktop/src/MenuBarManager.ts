import { BrowserWindow, Rectangle, Tray, nativeImage, screen } from 'electron';
import path from 'path';
import { DailyPrayerTimes, PrayerTime, PrayerTimeCalculator } from '@prayer-time/shared';

interface MenuBarManagerOptions {
  onShowApp?: () => void;
}

export class MenuBarManager {
  private tray: Tray | null = null;
  private latestPrayerTimes: DailyPrayerTimes | null = null;
  private popoverWindow: BrowserWindow | null = null;
  private lastPopoverHtml: string | null = null;

  constructor(private readonly options: MenuBarManagerOptions = {}) {}

  update(prayerTimes: DailyPrayerTimes) {
    this.latestPrayerTimes = prayerTimes;

    if (!this.tray) {
      this.initializeTray();
    }

    if (!this.tray) {
      return;
    }

    const reference = new Date();
    const nextPrayer = PrayerTimeCalculator.getNextPrayerTime(prayerTimes.prayers, reference);
    const remainingLabel = nextPrayer
      ? this.formatTimeRemaining(PrayerTimeCalculator.getTimeUntilPrayer(nextPrayer, reference))
      : null;

    if (nextPrayer && remainingLabel) {
      this.tray.setToolTip(`Next: ${nextPrayer.name} at ${nextPrayer.time} (${remainingLabel})`);
    } else {
      this.tray.setToolTip('Prayer Time');
    }

    if (process.platform === 'darwin') {
      const title = nextPrayer && remainingLabel ? `${nextPrayer.name} ${remainingLabel}` : 'Prayer Time';
      this.tray.setTitle(title);
    }

    const popoverHtml = this.buildPopoverHtml(prayerTimes, reference, nextPrayer ?? null, remainingLabel);
    this.lastPopoverHtml = popoverHtml;
    if (this.popoverWindow) {
      this.loadPopoverHtml(popoverHtml);
    }
  }

  hidePopover() {
    if (this.popoverWindow?.isVisible()) {
      this.popoverWindow.hide();
    }
  }

  destroy() {
    this.tray?.destroy();
    this.tray = null;
    this.latestPrayerTimes = null;
    this.hidePopover();
    this.popoverWindow?.destroy();
    this.popoverWindow = null;
    this.lastPopoverHtml = null;
  }

  private initializeTray() {
    const icon = nativeImage.createEmpty();
    icon.setTemplateImage(true);

    this.tray = new Tray(icon);
    this.tray.setIgnoreDoubleClickEvents(true);

    this.tray.on('click', (_event, bounds) => {
      this.togglePopover(bounds);
    });

    this.tray.on('right-click', (_event, bounds) => {
      this.togglePopover(bounds);
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

  private ensurePopoverWindow(): BrowserWindow {
    if (this.popoverWindow) {
      return this.popoverWindow;
    }

    this.popoverWindow = new BrowserWindow({
      width: 320,
      height: 370,
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
        preload: path.join(__dirname, 'menu-preload.js'),
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

  private togglePopover(triggerBounds?: Rectangle) {
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

  private positionPopover(window: BrowserWindow, trayBounds: Rectangle) {
    const windowBounds = window.getBounds();
    const targetDisplay = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
    const workArea = targetDisplay.workArea;

    let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
    let y: number;

    if (process.platform === 'darwin') {
      y = Math.round(trayBounds.y + trayBounds.height + 4);
    } else {
      y = Math.round(trayBounds.y - windowBounds.height - 4);
    }

    x = Math.min(Math.max(workArea.x, x), workArea.x + workArea.width - windowBounds.width);
    y = Math.min(Math.max(workArea.y, y), workArea.y + workArea.height - windowBounds.height);

    window.setPosition(x, y, false);
  }

  private loadPopoverHtml(html: string) {
    if (!this.popoverWindow) {
      return;
    }

    const encoded = Buffer.from(html, 'utf8').toString('base64');
    this.popoverWindow.loadURL(`data:text/html;base64,${encoded}`);
  }

  private buildPopoverHtml(
    prayerTimes: DailyPrayerTimes,
    reference: Date,
    nextPrayer: PrayerTime | null,
    remainingLabel: string | null
  ): string {
    const schedule = prayerTimes.prayers.map((prayer) => {
      const isNext = nextPrayer?.name === prayer.name;
      const occurrence = PrayerTimeCalculator.getOccurrenceForDate(prayer, reference);
      const diff = occurrence.getTime() - reference.getTime();
      const isPast = diff < 0 && !isNext;
      const relative = this.formatRelativeLabel(diff, isNext, isPast, remainingLabel);
      const status = isNext ? 'Next' : isPast ? 'Completed' : 'Upcoming';
      const stateClass = isNext ? 'next' : isPast ? 'past' : 'upcoming';

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
          <div class="next-countdown">${
            remainingLabel === 'Now' ? 'Starting now' : remainingLabel ? `in ${remainingLabel}` : ''
          }</div>
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
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: linear-gradient(160deg, #091421 0%, #14263a 55%, #0a1c2c 100%);
        color: #e2e8f0;
        min-height: 100%;
      }

      .tray-shell {
        width: 100%;
        height: 100%;
        padding: 0.8rem 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        justify-content: space-between;
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

      .pill-clock.muted {
        color: rgba(226, 232, 240, 0.4);
      }

      .pill-relative {
        font-size: 0.58rem;
        color: rgba(226, 232, 240, 0.7);
        letter-spacing: 0.04em;
      }

      .actions {
        display: flex;
        justify-content: space-between;
        gap: 0.42rem;
      }

      .actions button {
        flex: 1;
        padding: 0.46rem 0.66rem;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        background: rgba(13, 24, 35, 0.65);
        color: rgba(226, 232, 240, 0.85);
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        transition: transform 0.18s ease, border-color 0.18s ease;
      }

      .actions button.primary {
        background: linear-gradient(135deg, #38bdf8 0%, #2563eb 90%);
        border-color: rgba(37, 99, 235, 0.6);
        color: #f8fafc;
      }

      .actions button.secondary {
        border-color: rgba(148, 163, 184, 0.35);
        background: rgba(15, 25, 38, 0.7);
      }

      .actions button:hover {
        transform: translateY(-2px);
        border-color: rgba(148, 163, 184, 0.45);
      }

      .actions button.primary:hover {
        border-color: rgba(37, 99, 235, 0.8);
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
      <div class="actions">
        <button class="primary" data-action="openApp">Open App</button>
        <button class="secondary" data-action="manageNotifications">Notifications</button>
        <button data-action="quitApp">Quit</button>
      </div>
    </div>
    <script>
      const invokeAction = (action) => {
        if (window.tray && typeof window.tray[action] === 'function') {
          window.tray[action]();
        }
      };

      document.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          invokeAction(button.getAttribute('data-action'));
        });
      });

      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          invokeAction('hidePopover');
        }
      });
    </script>
  </body>
</html>`;
  }

  private formatRelativeLabel(
    diff: number,
    isNext: boolean,
    isPast: boolean,
    remainingLabel: string | null
  ): string {
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

  private formatTimeRemaining(milliseconds: number): string {
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
