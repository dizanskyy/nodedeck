import { useEffect } from "react";

// Заставка: надпись NodeDeck плавно появляется и плавно исчезает,
// затем колбэк переводит приложение к экрану входа.
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="splash">
      <div className="splash-logo">
        <span className="splash-mark" />
        <span className="splash-word">NodeDeck</span>
      </div>
      <div className="splash-tag">Твой хостинг. Под полным контролем.</div>
    </div>
  );
}
