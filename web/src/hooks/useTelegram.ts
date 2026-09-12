import { useEffect, useMemo } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export function useTelegram() {
  const tg = useMemo(() => {
    return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  }, []);

  const isTelegram = Boolean(tg && tg.initData);

  useEffect(() => {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        // Set header color to match dark background
        if (tg.setHeaderColor) {
          tg.setHeaderColor('#090d16');
        }
      } catch (err) {
        console.warn('Could not initialize Telegram WebApp view:', err);
      }
    }
  }, [tg]);

  const haptic = useMemo(
    () => ({
      impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
        try {
          tg?.HapticFeedback?.impactOccurred(style);
        } catch {
          // fallback
        }
      },
      notification: (type: 'error' | 'success' | 'warning') => {
        try {
          tg?.HapticFeedback?.notificationOccurred(type);
        } catch {
          // fallback
        }
      },
      selection: () => {
        try {
          tg?.HapticFeedback?.selectionChanged();
        } catch {
          // fallback
        }
      },
    }),
    [tg]
  );

  const close = () => {
    try {
      tg?.close();
    } catch {
      // fallback
    }
  };

  const openLink = (url: string) => {
    try {
      if (tg?.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      window.open(url, '_blank');
    }
  };

  return {
    tg,
    isTelegram,
    user: tg?.initDataUnsafe?.user || null,
    haptic,
    close,
    openLink,
  };
}
