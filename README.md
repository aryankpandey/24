# 24

**You don't have 24 hours. You have what's left.**

24 is an offline-first mobile time widget/application that shows you how much of today is left.

## Concept

The concept is inspired by the idea of *In Time* (2011), where time is the most valuable and finite currency.

The application does not manage your life. It simply reflects that today is disappearing in real time. There are no start, pause, or reset controls.

## Features

- **Offline-First**: Requires no internet connection to calculate remaining time.
- **Local Timezone**: Automatically detects and adapts to your device's timezone.
- **Minimalist Design**: A clean, distraction-free interface.
- **Progressive Web App**: Installable on Android and iOS devices.

## Usage

1. Open the application in a web browser.
2. Install it as a PWA (Add to Home Screen).
3. Open it at any time to see your remaining time today.

## Technical Details

- **Web layer**: HTML5, CSS3, Vanilla JavaScript, Service Workers.
- Time is always calculated based on the current system clock (`Date.now()`) to ensure no drift occurs when the device sleeps.
