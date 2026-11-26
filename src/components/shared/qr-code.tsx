import QRCode from "qrcode";

/** QR em SVG gerado no servidor (sem dangerouslySetInnerHTML). Fundo branco e zona de silêncio para leitura em app bancário. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 4;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) cells.push({ x: x + quiet, y: y + quiet });
  const size = n + quiet * 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="size-64 max-w-full rounded-controle bg-white" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      {cells.map((c) => <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="1" height="1" fill="#000" />)}
    </svg>
  );
}
