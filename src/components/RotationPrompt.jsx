import { RotateCw, Smartphone } from "lucide-react";
import { useState } from "react";

export default function RotationPrompt() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="remi-rotation-prompt" role="dialog" aria-modal="true" aria-label="Rotate your device">
      <div className="relative">
        <Smartphone size={54} strokeWidth={1.3} />
        <RotateCw className="absolute -right-7 -top-4 text-remi-gold-light" size={34} strokeWidth={1.5} />
      </div>
      <p>Rotate your device for the best experience</p>
      <button type="button" onClick={() => setDismissed(true)}>
        Continue anyway →
      </button>
    </div>
  );
}
