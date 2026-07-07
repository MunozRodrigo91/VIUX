import React, { useState } from "react";
import { ArrowRight, ShieldCheck, MapPin, Check, Info, Clock, Heart, Leaf, FileText, Map } from "lucide-react";

interface LandingPageProps {
  partner?: string;
  onStartBooking: () => void;
}

export default function LandingPage({ partner, onStartBooking }: LandingPageProps) {
  const [showFullPartnerLanding, setShowFullPartnerLanding] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>("pinamar");

  const isPartner = !!partner;
  const showHeroAndOffer = !isPartner || showFullPartnerLanding;

  // Information about each zone for our interactive map
  const zoneDetails: { [key: string]: { title: string; desc: string; paths: string } } = {
    pinamar: {
      title: "Pinamar (Centro y Norte)",
      desc: "Excelente red de ciclovías a lo largo de Av. Bunge, Av. del Libertador y Av. del Mar. Ideal para circular de forma ágil y conectarse directo con la playa de manera sustentable.",
      paths: "Ciclovías pavimentadas de Av. Bunge y senderos linderos autorizados."
    },
    ostende: {
      title: "Mar de Ostende",
      desc: "Zonas de circulación tranquila por calles secundarias autorizadas. Permite conectar el centro de Pinamar con Valeria del Mar bordeando la costa sin ingresar a zonas prohibidas.",
      paths: "Calles consolidadas y peatonales autorizadas por normativa."
    },
    valeria: {
      title: "Valeria del Mar",
      desc: "Calles arboladas y tranquilas, con puntos de encuentro flexibles cerca de la rotonda de ingreso y la costanera para un retiro súper cómodo.",
      paths: "Zonas de baja velocidad linderas a centros comerciales y playas."
    },
    carilo: {
      title: "Cariló",
      desc: "La combinación perfecta de bosque y sustentabilidad. Coordinamos entregas en accesos peatonales y centros comerciales respetando el silencio y cuidado natural.",
      paths: "Senderos consolidados aptos para monopatines eléctricos de última generación."
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#060608] text-[#FAFAF8] font-sans selection:bg-[#FF5500] selection:text-white">
      {/* 1. HERO / HEADER */}
      <header className="relative py-16 md:py-24 px-6 overflow-hidden border-b border-white/5">
        {/* Glow decoration */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#FF5500]/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto space-y-6 relative z-10 text-center md:text-left">
          {isPartner && (
            <div className="inline-flex items-center space-x-2 bg-[#FF5500]/10 text-[#FF5500] border border-[#FF5500]/35 text-xs px-4 py-2 rounded-full font-bold neon-orange-glow">
              <span>🏨 Convenio Especial: {partner}</span>
            </div>
          )}

          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight text-white leading-tight max-w-3xl">
              Movete por Pinamar en <span className="text-[#FF5500] neon-orange-text">monopatín eléctrico.</span>
            </h1>
            <p className="text-base md:text-lg font-light text-zinc-400 max-w-2xl leading-relaxed">
              Equipos Xiaomi 6 Pro de última generación, listos todos los días. Reservá hoy de forma ágil y segura en un solo clic.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 pt-4">
            <button
              onClick={onStartBooking}
              className="brand-button w-full sm:w-auto bg-[#FF5500] hover:bg-[#ff6e1a] text-white text-base py-4 px-8 flex items-center justify-center space-x-2.5 shadow-lg shadow-[#FF5500]/20 active:scale-[0.98] transition-all cursor-pointer font-bold rounded-lg uppercase tracking-wide"
            >
              <span>Reservar ahora</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            
            {isPartner && !showFullPartnerLanding && (
              <button
                onClick={() => setShowFullPartnerLanding(true)}
                className="text-xs font-semibold text-zinc-400 hover:text-white underline cursor-pointer transition-colors"
              >
                Ver propuesta completa de VIUX
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. ECO-FRIENDLY & SUSTAINABILITY FOCUS BLOCK */}
      <section className="py-12 px-6 max-w-4xl mx-auto w-full">
        <div className="bg-gradient-to-r from-emerald-950/30 to-zinc-900 border border-emerald-500/15 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full text-xs font-bold">
              <Leaf className="w-3.5 h-3.5" />
              <span>Movilidad Sustentable</span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Una elección inteligente para vos y el planeta
            </h3>
            <p className="text-xs md:text-sm text-zinc-300 font-light leading-relaxed">
              Recorrer Pinamar en nuestros monopatines es una excelente elección para explorar la ciudad sumándote activamente al cuidado del medioambiente. Cero emisiones de CO2, contaminación acústica nula y el máximo disfrute de los paisajes naturales de nuestra costa.
            </p>
          </div>
          <div className="shrink-0 flex items-center justify-center w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
            <Leaf className="w-12 h-12" />
          </div>
        </div>
      </section>

      {/* 3. QUÉ OFRECEMOS */}
      {showHeroAndOffer && (
        <section className="py-12 px-6 max-w-4xl mx-auto w-full space-y-10">
          <div className="text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-display font-black text-white tracking-tight uppercase">
              Qué <span className="text-[#FF5500]">ofrecemos</span>
            </h2>
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed font-light">
              Una experiencia sustentable, ágil y divertida de recorrer nuestra ciudad...
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-xl space-y-4 hover:border-[#FF5500]/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-[#FF5500]/10 flex items-center justify-center text-[#FF5500] border border-[#FF5500]/20">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">Turnos de 1 Hora</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Bloques de tiempo habilitados dinámicamente por el operador para optimizar tu recorrido sin demoras molestas.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl space-y-4 hover:border-[#FF5500]/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-[#FF5500]/10 flex items-center justify-center text-[#FF5500] border border-[#FF5500]/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">Equipo de Seguridad</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Priorizamos tu integridad física. Tu reserva incluye un kit completo de seguridad sanitizado: **Casco**, **coderas** y **rodilleras**.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl space-y-4 hover:border-[#FF5500]/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-[#FF5500]/10 flex items-center justify-center text-[#FF5500] border border-[#FF5500]/20">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">Reserva Dinámica</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Congelás tus equipos abonando una seña online del 30% y cancelando el saldo al retirar de forma transparente.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 4. MODALIDAD DE ENTREGA */}
      <section className="py-12 px-6 max-w-4xl mx-auto w-full space-y-10 border-t border-white/5">
        <div className="text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-display font-black text-white tracking-tight uppercase">
            Puntos de <span className="text-[#FF5500]">Entrega</span>
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed font-light">
            No tenemos un punto fijo de entrega. Coordinamos juntos para tu mayor comodidad.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card-orange p-6 rounded-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF5500] neon-orange-text">Opción Especial Hoteles</div>
            <h3 className="font-bold text-lg text-white">Entrega en la puerta de tu Hotel</h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-light">
              Si te hospedás en uno de nuestros hoteles partners locales, te llevamos y retiramos los equipos directamente en el lobby del hotel. El check-in se realiza al instante para que no pierdas ni un minuto.
            </p>
          </div>

          <div className="glass-card p-6 rounded-xl space-y-4 border-l-2 border-l-[#FF5500]/40">
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">Puntos acordados</div>
            <h3 className="font-bold text-lg text-white">Acordamos tu Punto de Encuentro</h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-light">
              Luego de confirmada tu reserva, nos ponemos en contacto para acordar juntos el punto de encuentro ideal. Contamos con puntos clave de entrega y retiro distribuidos en: <strong className="text-[#FAFAF8]">Pinamar, Valeria del Mar, Mar de Ostende y Cariló</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE MAP SECTION & PERMITTED CIRCUITS */}
      <section className="py-12 px-6 max-w-4xl mx-auto w-full space-y-8 border-t border-white/5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center space-x-1 text-[#FF5500] text-xs font-bold uppercase tracking-widest mb-1">
              <Map className="w-3.5 h-3.5" />
              <span>Mapa de Recorrido Habilitado</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-black text-white tracking-tight uppercase">
              Circuitos <span className="text-[#FF5500]">Permitidos</span>
            </h2>
            <p className="text-sm text-zinc-400 mt-1 leading-relaxed font-light">
              Explorá las zonas autorizadas de circulación en el partido de Pinamar.
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-1.5">
            {Object.keys(zoneDetails).map((z) => (
              <button
                key={z}
                onClick={() => setSelectedZone(z)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
                  selectedZone === z
                    ? "bg-[#FF5500] text-white shadow-md shadow-[#FF5500]/15"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-white/5"
                }`}
              >
                {z.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Visual SVG Map */}
          <div className="md:col-span-7 bg-[#0b0b0f] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
            {/* Background grids */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#FF5500]/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Styled Pinamar Coast Map representation */}
            <svg viewBox="0 0 400 300" className="w-full max-w-[340px] relative z-10 drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Sea representation */}
              <path d="M 320 0 L 320 300 L 400 300 L 400 0 Z" fill="#FF5500" fillOpacity="0.02" />
              {/* Coastline */}
              <line x1="320" y1="0" x2="320" y2="300" stroke="#FF5500" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.3" />
              <text x="360" y="150" fill="#FF5500" fillOpacity="0.4" fontSize="10" fontWeight="bold" transform="rotate(90 360 150)" textAnchor="middle" className="tracking-widest">MAR ARGENTINO</text>
              
              {/* Route 11 main connector */}
              <path d="M 60 0 L 60 300" stroke="#222" strokeWidth="4" />
              <text x="50" y="20" fill="#444" fontSize="8" fontWeight="bold" transform="rotate(-90 50 20)">RUTA 11</text>

              {/* Pinamar circuits and zones */}
              {/* Pinamar zone */}
              <g className="cursor-pointer" onClick={() => setSelectedZone("pinamar")}>
                <rect x="100" y="20" width="180" height="70" rx="10" fill={selectedZone === "pinamar" ? "#FF5500" : "#222"} fillOpacity={selectedZone === "pinamar" ? "0.15" : "0.3"} stroke={selectedZone === "pinamar" ? "#FF5500" : "#444"} strokeWidth={selectedZone === "pinamar" ? "1.5" : "1"} />
                <text x="190" y="50" fill={selectedZone === "pinamar" ? "#FFF" : "#AAA"} fontSize="12" fontWeight="bold" textAnchor="middle">PINAMAR</text>
                <text x="190" y="65" fill={selectedZone === "pinamar" ? "#FF5500" : "#666"} fontSize="8" textAnchor="middle">Ciclovías Av. Bunge</text>
                {selectedZone === "pinamar" && <circle cx="190" cy="30" r="4" fill="#FF5500" className="animate-ping" />}
              </g>

              {/* Ostende zone */}
              <g className="cursor-pointer" onClick={() => setSelectedZone("ostende")}>
                <rect x="100" y="100" width="180" height="50" rx="10" fill={selectedZone === "ostende" ? "#FF5500" : "#222"} fillOpacity={selectedZone === "ostende" ? "0.15" : "0.3"} stroke={selectedZone === "ostende" ? "#FF5500" : "#444"} strokeWidth={selectedZone === "ostende" ? "1.5" : "1"} />
                <text x="190" y="125" fill={selectedZone === "ostende" ? "#FFF" : "#AAA"} fontSize="11" fontWeight="bold" textAnchor="middle">MAR DE OSTENDE</text>
                <text x="190" y="138" fill={selectedZone === "ostende" ? "#FF5500" : "#666"} fontSize="8" textAnchor="middle">Zonas costeras tranquilas</text>
                {selectedZone === "ostende" && <circle cx="190" cy="110" r="4" fill="#FF5500" className="animate-ping" />}
              </g>

              {/* Valeria zone */}
              <g className="cursor-pointer" onClick={() => setSelectedZone("valeria")}>
                <rect x="100" y="160" width="180" height="50" rx="10" fill={selectedZone === "valeria" ? "#FF5500" : "#222"} fillOpacity={selectedZone === "valeria" ? "0.15" : "0.3"} stroke={selectedZone === "valeria" ? "#FF5500" : "#444"} strokeWidth={selectedZone === "valeria" ? "1.5" : "1"} />
                <text x="190" y="185" fill={selectedZone === "valeria" ? "#FFF" : "#AAA"} fontSize="11" fontWeight="bold" textAnchor="middle">VALERIA DEL MAR</text>
                <text x="190" y="198" fill={selectedZone === "valeria" ? "#FF5500" : "#666"} fontSize="8" textAnchor="middle">Arboledas y rotondas</text>
                {selectedZone === "valeria" && <circle cx="190" cy="170" r="4" fill="#FF5500" className="animate-ping" />}
              </g>

              {/* Carilo zone */}
              <g className="cursor-pointer" onClick={() => setSelectedZone("carilo")}>
                <rect x="100" y="220" width="180" height="60" rx="10" fill={selectedZone === "carilo" ? "#FF5500" : "#222"} fillOpacity={selectedZone === "carilo" ? "0.15" : "0.3"} stroke={selectedZone === "carilo" ? "#FF5500" : "#444"} strokeWidth={selectedZone === "carilo" ? "1.5" : "1"} />
                <text x="190" y="248" fill={selectedZone === "carilo" ? "#FFF" : "#AAA"} fontSize="12" fontWeight="bold" textAnchor="middle">CARILÓ</text>
                <text x="190" y="262" fill={selectedZone === "carilo" ? "#FF5500" : "#666"} fontSize="8" textAnchor="middle">Senderos de bosque</text>
                {selectedZone === "carilo" && <circle cx="190" cy="230" r="4" fill="#FF5500" className="animate-ping" />}
              </g>

              {/* Main connecting roads (Ciclovía) */}
              <path d="M 190 90 L 190 100 M 190 150 L 190 160 M 190 210 L 190 220" stroke="#FF5500" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.5" />
            </svg>
            
            <span className="text-[10px] text-zinc-500 mt-2 font-mono">
              * Hacé clic en las regiones del mapa para ver detalles
            </span>
          </div>

          {/* Zone Description Panel */}
          <div className="md:col-span-5 flex flex-col justify-between bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#FF5500] bg-[#FF5500]/10 px-2.5 py-1 rounded-md inline-block">
                Zona de Circulación Seleccionada
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {zoneDetails[selectedZone].title}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-light">
                {zoneDetails[selectedZone].desc}
              </p>
              <div className="pt-3 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Sectores recomendados:</span>
                <span className="text-xs text-[#FF5500] font-medium leading-normal block">
                  {zoneDetails[selectedZone].paths}
                </span>
              </div>
            </div>
            
            <div className="bg-emerald-950/20 border border-emerald-500/10 p-3.5 rounded-xl flex items-start space-x-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider block">Seguro de Responsabilidad Civil</span>
                <p className="text-[10px] text-zinc-300 leading-normal font-light">
                  Tu reserva incluye automáticamente cobertura de seguro de responsabilidad civil para terceros mientras transitás por las zonas recomendadas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONDICIONES Y REQUISITOS (WITH ORDINANCE & INSURANCE) */}
      <section className="py-12 px-6 max-w-4xl mx-auto w-full space-y-8 border-t border-white/5">
        <div className="text-left">
          <div className="inline-flex items-center space-x-1.5 text-xs text-[#FF5500] font-bold bg-[#FF5500]/10 border border-[#FF5500]/15 px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            <span>Ordenanza Municipal Vigente</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-black text-white tracking-tight uppercase flex items-start gap-2.5">
            <Info className="w-6 h-6 text-[#FF5500] shrink-0 mt-0.5" />
            <span className="leading-tight">
              Normativas y <span className="text-[#FF5500]">Requisitos</span>
            </span>
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-2 leading-relaxed font-light">
            Nuestros monopatines y elementos de seguridad cumplen estrictamente con la <strong className="text-white font-semibold">Ordenanza N.° 005/2026</strong> de la municipalidad de Pinamar para una circulación totalmente legal y segura.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Item 1 */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-[#FF5500]/20 transition-colors duration-200">
            <div className="w-7 h-7 rounded-lg bg-[#FF5500]/10 flex items-center justify-center shrink-0 text-[#FF5500] border border-[#FF5500]/20 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Edad Mínima</h4>
              <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                Debes tener <strong className="text-white">18 años o más</strong> con responsabilidad civil de conducción habilitada.
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-[#FF5500]/20 transition-colors duration-200">
            <div className="w-7 h-7 rounded-lg bg-[#FF5500]/10 flex items-center justify-center shrink-0 text-[#FF5500] border border-[#FF5500]/20 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">DNI Físico Obligatorio</h4>
              <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                Se requiere presentar físicamente tu <strong className="text-white">DNI original</strong> al operador para el check-in (sin excepción).
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-[#FF5500]/20 transition-colors duration-200">
            <div className="w-7 h-7 rounded-lg bg-[#FF5500]/10 flex items-center justify-center shrink-0 text-[#FF5500] border border-[#FF5500]/20 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Garantía Reembolsable</h4>
              <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                Deberás dejar un depósito de garantía reembolsable en <strong className="text-white">efectivo</strong> que se reintegra al finalizar el alquiler.
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-[#FF5500]/20 transition-colors duration-200">
            <div className="w-7 h-7 rounded-lg bg-[#FF5500]/10 flex items-center justify-center shrink-0 text-[#FF5500] border border-[#FF5500]/20 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Equipo de Seguridad</h4>
              <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                El uso del <strong className="text-white">casco, coderas y rodilleras</strong> provistos es legalmente obligatorio durante todo el trayecto.
              </p>
            </div>
          </div>

          {/* Item 5 */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-[#FF5500]/20 transition-colors duration-200">
            <div className="w-7 h-7 rounded-lg bg-[#FF5500]/10 flex items-center justify-center shrink-0 text-[#FF5500] border border-[#FF5500]/20 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tolerancia de Retiro</h4>
              <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                Se otorgan <strong className="text-white">15 minutos de tolerancia</strong> para retirar. Cumplido el plazo se declara No-Show.
              </p>
            </div>
          </div>

          {/* Item 6 */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-[#FF5500]/20 transition-colors duration-200">
            <div className="w-7 h-7 rounded-lg bg-[#FF5500]/10 flex items-center justify-center shrink-0 text-[#FF5500] border border-[#FF5500]/20 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Vías Habilitadas</h4>
              <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                Transitar únicamente por vías públicas autorizadas de Pinamar. <strong className="text-rose-400">Prohibido circular sobre playas o dunas</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CTA FINAL */}
      <section className="relative py-20 px-6 text-center border-t border-white/5 bg-black/40 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#FF5500]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-2xl mx-auto space-y-6 relative z-10">
          <h2 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-white uppercase">
            ¿Todo listo para salir a <span className="text-[#FF5500]">circular?</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed font-light">
            Reservá tu Xiaomi 6 Pro en simples pasos. Asegurá tu turno abonando la seña del 30% en pesos de forma 100% online y segura.
          </p>
          <div className="pt-4">
            <button
              onClick={onStartBooking}
              className="brand-button bg-[#FF5500] hover:bg-[#ff6e1a] text-white text-base py-4 px-10 inline-flex items-center space-x-2.5 shadow-lg shadow-[#FF5500]/10 active:scale-[0.98] transition-all cursor-pointer font-bold rounded-lg uppercase tracking-wider"
            >
              <span>Empezar Reserva</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
