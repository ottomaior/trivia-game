import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** Renders the join URL as an inline SVG QR code (cream on burgundy ink). */
export function QrCode({ value, className }: { value: string; className?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#2A0E18', light: '#F4E9D4' },
    }).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return <div className={className} role="img" aria-label={value} dangerouslySetInnerHTML={{ __html: svg }} />;
}
