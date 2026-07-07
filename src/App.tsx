import React, { useState, useEffect } from "react";
import { Config, Reserva } from "./types";
import ProgressIndicator from "./components/ProgressIndicator";
import PublicBooking from "./components/PublicBooking";
import TicketView from "./components/TicketView";
import AdminPanel from "./components/AdminPanel";
import LandingPage from "./components/LandingPage";
import { Sparkles, Compass, ShieldAlert, AlertTriangle, Key, User, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [view, setView] = useState<"public" | "admin">("public");
  const [partner, setPartner] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [startedBooking, setStartedBooking] = useState<boolean>(false);
  const [currentReserva, setCurrentReserva] = useState<Reserva | null>(null);
  
  // App Config
  const [config, setConfig] = useState<Config>({
    precioPorHora: 8000,
    montoGarantia: 10000,
    porcentajeSeña: 30,
    toleranciaNoShowMinutos: 15,
    capacidadMaximaScooters: 4
  });

  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_auth") === "true";
    }
    return false;
  });
  const [loginUser, setLoginUser] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  useEffect(() => {
    // 1. Fetch backend config
    fetch("/api/config")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        setConfig(data);
        setLoadingConfig(false);
      })
      .catch(() => {
        setLoadingConfig(false);
      });

    // 2. Parse query parameters
    const params = new URLSearchParams(window.location.search);
    const partnerParam = params.get("partner");
    if (partnerParam) {
      setPartner(partnerParam);
    }

    const confirmedId = params.get("reserva_confirmada");
    if (confirmedId) {
      // Fetch the newly confirmed reservation from backend
      fetch(`/api/reservas/${confirmedId}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then((reservaData) => {
          setCurrentReserva(reservaData);
          setCurrentStep(5); // Render step 5 ticket
          setStartedBooking(true); // Bypass landing
          setNotification({
            message: `¡Seña de $${reservaData.monto_seña.toLocaleString("es-AR")} cobrada con éxito! Tu reserva está activa.`,
            type: "success"
          });
        })
        .catch(() => {
          setNotification({
            message: "No se pudo cargar el ticket de reserva.",
            type: "error"
          });
        });
    }

    const failedId = params.get("reserva_fallida");
    if (failedId) {
      setNotification({
        message: "El pago de la seña con MercadoPago no se pudo completar. Intentá de nuevo.",
        type: "error"
      });
    }

    // SSE for configuration changes
    const eventSource = new EventSource("/api/realtime");
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "config_updated") {
          setConfig(parsed.data);
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleBookingSuccess = (reserva: Reserva) => {
    setCurrentReserva(reserva);
    setCurrentStep(5); // Go to step 5 ticket view
    setNotification({
      message: `¡Reserva confirmada con éxito para ${reserva.nombre_cliente}!`,
      type: "success"
    });
  };

  const handleBackToStart = () => {
    setCurrentReserva(null);
    setCurrentStep(1);
    setStartedBooking(false); // Reset to landing page
    window.history.pushState({}, document.title, window.location.pathname + (partner ? `?partner=${partner}` : ""));
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    // Validate using Mock Data
    if (loginUser.trim().toLowerCase() === "admin" && loginPassword === "admin") {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
      setLoginUser("");
      setLoginPassword("");
    } else {
      setLoginError("Usuario o contraseña incorrectos. Intentá nuevamente.");
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem("admin_auth");
    setView("public");
    setNotification({
      message: "Sesión de administración cerrada correctamente.",
      type: "success"
    });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased text-white selection:bg-[#FF5500] selection:text-white bg-[#0A0A0C] relative">
      {/* Decorative gradient blob background */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#FF5500]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-[#FF5500]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Visual Navigation Bar */}
      <header className="bg-black/40 backdrop-blur-md sticky top-0 z-50 py-3.5 px-4 border-b border-white/10 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            type="button" 
            onClick={handleBackToStart} 
            className="flex items-center space-x-3 text-left focus:outline-none cursor-pointer"
          >
            {/* Logo Pin */}
            <div className="w-10 h-10 rounded-xl bg-[#FF5500] flex items-center justify-center text-white font-black text-lg shadow-[0_0_12px_rgba(255,85,0,0.4)]">
              VX
            </div>
            <div>
              <span className="text-base font-display font-extrabold tracking-tight text-white block uppercase">
                VIUX
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-[#FF5500] block -mt-0.5 neon-orange-text">
                Alquiler por Hora
              </span>
            </div>
          </button>

          {/* Desktop View Toggles */}
          <div className="hidden md:flex p-1 rounded-xl bg-black/40 border border-white/10">
            <button
              onClick={() => {
                setView("public");
                setStartedBooking(true);
                setCurrentReserva(null);
                setCurrentStep(1);
              }}
              className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                view === "public"
                  ? "bg-[#FF5500] text-white shadow-md shadow-[#FF5500]/20"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Reservar</span>
            </button>
            
            <button
              onClick={() => setView("admin")}
              className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                view === "admin"
                  ? "bg-[#FF5500] text-white shadow-md shadow-[#FF5500]/20"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Panel Operador</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Banner */}
      <AnimatePresence>
        {notification && (
          <div className={`border-b py-3 px-4 sticky top-[68px] z-40 backdrop-blur-md ${
            notification.type === "success" 
              ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-300" 
              : "bg-red-950/20 border-red-500/20 text-red-300"
          }`}>
            <div className="max-w-md mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className={`w-2 h-2 rounded-full ${notification.type === "success" ? "bg-emerald-400" : "bg-red-400"} animate-pulse shadow-sm`} />
                <p className="text-xs font-bold leading-relaxed">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-zinc-400 hover:text-white ml-4 font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW DELEGATION WITH SMOOTH TRANSITIONS */}
      <main className="flex-grow py-4 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {view === "public" ? (
              <div>
                {!startedBooking ? (
                  <LandingPage 
                    partner={partner} 
                    onStartBooking={() => {
                      setStartedBooking(true);
                      setCurrentStep(1);
                    }} 
                  />
                ) : (
                  <div>
                    {/* Progress Indicator */}
                    <ProgressIndicator currentStep={currentReserva ? 5 : currentStep} />
                    
                    {currentStep === 5 && currentReserva ? (
                      <TicketView reserva={currentReserva} onBackToStart={handleBackToStart} />
                    ) : (
                      <PublicBooking 
                        partner={partner} 
                        config={config}
                        onBookingSuccess={handleBookingSuccess} 
                        onStepChange={setCurrentStep}
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              // ADMIN VIEW SECTION with login protection
              <div className="px-4">
                {isAdminAuthenticated ? (
                  <AdminPanel 
                    config={config} 
                    onUpdateConfig={(updated) => setConfig(updated)}
                    onLogout={handleAdminLogout}
                  />
                ) : (
                  // GORGEOUS GLASSMORPHISM LOGIN FORM
                  <div className="max-w-md mx-auto my-12">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] mb-3 neon-orange-glow">
                        <Key className="w-5 h-5" />
                      </div>
                      <h2 className="text-xl font-display font-extrabold text-white tracking-tight uppercase">Autenticación</h2>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-light">
                        Ingresá tus credenciales de operador para administrar reservas y caja.
                      </p>
                    </div>

                    <form onSubmit={handleAdminLogin} className="glass-card rounded-2xl p-6 space-y-4 border border-white/10 relative overflow-hidden">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block">
                          Nombre de Usuario
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                            <User className="w-4.5 h-4.5 text-[#FF5500]" />
                          </span>
                          <input
                            type="text"
                            required
                            placeholder="admin"
                            value={loginUser}
                            onChange={(e) => setLoginUser(e.target.value)}
                            className="w-full h-11 border border-white/10 rounded-xl pl-10 pr-4 bg-black/40 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all placeholder-zinc-500 font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block">
                          Contraseña de Acceso
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                            <Key className="w-4.5 h-4.5 text-[#FF5500]" />
                          </span>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="w-full h-11 border border-white/10 rounded-xl pl-10 pr-4 bg-black/40 text-xs text-white focus:outline-none focus:border-[#FF5500] transition-all placeholder-zinc-500 font-bold"
                          />
                        </div>
                      </div>

                      {loginError && (
                        <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-xs p-3 rounded-xl flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                          <span>{loginError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full h-11 bg-[#FF5500] hover:bg-[#ff6e1a] text-white rounded-xl font-bold flex items-center justify-center space-x-2 active:scale-[0.99] transition-all cursor-pointer text-sm uppercase tracking-wider shadow-lg shadow-[#FF5500]/10"
                      >
                        <span>Ingresar al Sistema</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <div className="text-[10px] text-center text-zinc-500 font-mono mt-2 pt-2 border-t border-white/5">
                        💡 Demo credentials: <strong className="text-zinc-300">admin / admin</strong>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Bottom Menu for Mobile Devices */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-black/60 backdrop-blur-lg rounded-full px-5 py-3 flex justify-around items-center gap-1 shadow-2xl border border-white/15 md:hidden">
        <button
          onClick={() => {
            setView("public");
            setStartedBooking(true);
            setCurrentReserva(null);
            setCurrentStep(1);
          }}
          className={`flex flex-col items-center justify-center w-20 py-1 rounded-2xl transition-all cursor-pointer relative ${
            view === "public"
              ? "text-white"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          {view === "public" && (
            <motion.div 
              layoutId="bubble"
              className="absolute inset-0 bg-[#FF5500]/15 rounded-2xl border border-[#FF5500]/25 -z-10"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <Compass className={`w-5 h-5 ${view === "public" ? "text-[#FF5500]" : ""}`} />
          <span className="text-[10px] font-bold mt-1 tracking-wide uppercase">Reservar</span>
        </button>

        <div className="h-6 w-px bg-white/10" />

        <button
          onClick={() => setView("admin")}
          className={`flex flex-col items-center justify-center w-20 py-1 rounded-2xl transition-all cursor-pointer relative ${
            view === "admin"
              ? "text-white"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          {view === "admin" && (
            <motion.div 
              layoutId="bubble"
              className="absolute inset-0 bg-[#FF5500]/15 rounded-2xl border border-[#FF5500]/25 -z-10"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <ShieldAlert className={`w-5 h-5 ${view === "admin" ? "text-[#FF5500]" : ""}`} />
          <span className="text-[10px] font-bold mt-1 tracking-wide uppercase">Admin</span>
        </button>
      </div>

      {/* Aesthetic Footer */}
      <footer className="bg-black/40 text-zinc-500 border-t border-white/10 py-8 text-center text-[10px] font-mono mt-auto relative z-10">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-3">
          <span>© 2026 VIUX - Alquiler de Monopatines</span>
          <div className="flex space-x-4">
            <span className="hover:text-white transition-colors">Bunge & Playa</span>
            <span>•</span>
            <span className="hover:text-white transition-colors">9:00 a 20:00 hs</span>
            <span>•</span>
            <span className="hover:text-white transition-colors">Pinamar, Argentina</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
