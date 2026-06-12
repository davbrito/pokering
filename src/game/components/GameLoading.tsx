const loadingMessages = [
  "Atrapando datos salvajes... \uD83D\uDCFE",
  "Eligiendo a tu Pokémon... \uD83D\uDCB0",
  "Preparando la arena... \u2694\uFE0F",
  "Calculando estadísticas... \uD83D\uDCCA",
  "Calentando motores... \uD83D\uDE80",
  "Buscando rival digno... \uD83D\uDC7E",
  "Afinando Pokéballs... \uD83D\uDDFB",
];

export function GameLoading() {
  return (
    <div className="route-loading h-full">
      <div className="pokeball-shake">
        <svg viewBox="0 0 100 100" className="pokeball-svg" role="img" aria-label="Pokéball cargando">
          <title>Pokéball</title>
          {/* Mitad superior (roja) */}
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="#ef4444" />
          {/* Mitad inferior (blanca) */}
          <path d="M 10 50 A 40 40 0 0 0 90 50" fill="#f3f4f6" />
          {/* Banda central */}
          <rect x="6" y="46" width="88" height="8" rx="3" fill="#1f2937" />
          {/* Botón central */}
          <circle cx="50" cy="50" r="10" fill="white" stroke="#1f2937" strokeWidth="3" />
          {/* Brillo superior estático */}
          <path
            d="M 30 22 Q 50 12 70 22"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
          {/* Destello — cruz exterior (se expande, rota CW) */}
          <g transform="translate(78, 22)">
            <g className="glint-outer" style={{ transformOrigin: "0px 0px" }}>
              <line x1="0" y1="-8" x2="0" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="-8" y1="0" x2="8" y2="0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="-5" y1="-5" x2="5" y2="5" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="5" y1="-5" x2="-5" y2="5" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
            </g>
          </g>
          {/* Destello — cruz interior (se encoge, rota CCW) */}
          <g transform="translate(78, 22)">
            <g className="glint-inner" style={{ transformOrigin: "0px 0px" }}>
              <line x1="0" y1="-6" x2="0" y2="6" stroke="white" strokeWidth="1" strokeLinecap="round" />
              <line x1="-6" y1="0" x2="6" y2="0" stroke="white" strokeWidth="1" strokeLinecap="round" />
              <line x1="-3" y1="-3" x2="3" y2="3" stroke="white" strokeWidth="0.5" strokeLinecap="round" />
              <line x1="3" y1="-3" x2="-3" y2="3" stroke="white" strokeWidth="0.5" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      </div>
      <div className="route-loading-msg-stack">
        {loadingMessages.map((msg, i) => (
          <p key={msg} className="route-loading-msg" style={{ animationDelay: `${i * 3}s` }}>
            {msg}
          </p>
        ))}
      </div>
    </div>
  );
}
