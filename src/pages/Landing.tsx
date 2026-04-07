import { useNavigate } from "react-router-dom";
import { Sparkles, Zap, Brain, Shield, ArrowRight, MessageSquare, BarChart3, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen-safe bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight">OptiNeural</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/pricing")} className="text-sm">
              Pricing
            </Button>
            <Button variant="ghost" onClick={() => navigate("/auth")} className="text-sm">
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} className="text-sm">
              Get Started <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Glow effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-model-blue/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
            <Zap className="w-3 h-3" />
            AI-Powered Multi-Model Chat
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            One interface,{" "}
            <span className="bg-gradient-to-r from-primary via-model-blue to-model-green bg-clip-text text-transparent">
              every AI model
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Compare GPT, Gemini, and Ollama responses side-by-side. Find the best AI for every task — all from a single, beautiful interface.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              Start Free <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/pricing")} className="text-base px-8 py-6 rounded-xl">
              View Pricing
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">5 free requests • No credit card required</p>
        </div>

        {/* Floating Island - Chat Preview */}
        <div className="max-w-3xl mx-auto mt-16 relative z-10">
          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/5 overflow-hidden">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-secondary/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-model-orange/60" />
                <div className="w-3 h-3 rounded-full bg-model-green/60" />
              </div>
              <div className="flex-1 mx-8">
                <div className="h-6 rounded-md bg-secondary/60 flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground font-mono">optineural.app</span>
                </div>
              </div>
            </div>

            {/* Fake chat content */}
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs">👤</span>
                </div>
                <div className="bg-secondary/50 rounded-xl rounded-tl-sm px-4 py-3 text-sm max-w-[80%]">
                  Explain the difference between transformers and RNNs
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-model-blue/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-model-blue" />
                </div>
                <div className="bg-card rounded-xl rounded-tl-sm px-4 py-3 text-sm border border-border/50 max-w-[85%]">
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-medium">Transformers</span> process all tokens in parallel using self-attention, while{" "}
                    <span className="text-foreground font-medium">RNNs</span> process sequences step-by-step. This makes transformers much faster to train and better at capturing long-range dependencies...
                  </p>
                </div>
              </div>
              {/* Typing indicator */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-model-green/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-model-green" />
                </div>
                <div className="bg-card rounded-xl rounded-tl-sm px-4 py-3 border border-border/50">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-model-green/60 animate-pulse-dot" />
                    <div className="w-2 h-2 rounded-full bg-model-green/60 animate-pulse-dot [animation-delay:0.2s]" />
                    <div className="w-2 h-2 rounded-full bg-model-green/60 animate-pulse-dot [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Float shadow */}
          <div className="absolute -bottom-4 left-8 right-8 h-8 bg-primary/5 blur-xl rounded-full" />
        </div>
      </section>

      {/* Features - Floating Islands */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need to compare AI</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Powerful features designed for researchers, developers, and teams who need the best AI output.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Brain className="w-5 h-5" />,
                color: "primary",
                title: "Multi-Model Access",
                desc: "GPT-4, Gemini, Ollama — all in one place. Switch models instantly or compare them side-by-side.",
              },
              {
                icon: <BarChart3 className="w-5 h-5" />,
                color: "model-blue",
                title: "Compare Mode",
                desc: "Send one prompt to every model simultaneously. See which AI gives the best answer for your use case.",
              },
              {
                icon: <MessageSquare className="w-5 h-5" />,
                color: "model-green",
                title: "Chat History",
                desc: "All conversations are saved automatically. Pick up where you left off, across all your devices.",
              },
              {
                icon: <Shield className="w-5 h-5" />,
                color: "model-orange",
                title: "Private & Secure",
                desc: "Your data stays yours. End-to-end encryption and row-level security on every conversation.",
              },
              {
                icon: <Globe className="w-5 h-5" />,
                color: "primary",
                title: "Local Models",
                desc: "Connect your own Ollama instance. Run models locally with zero data leaving your machine.",
              },
              {
                icon: <Zap className="w-5 h-5" />,
                color: "model-blue",
                title: "Streaming Responses",
                desc: "Watch AI think in real-time. Streaming responses with beautiful markdown rendering.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="group relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                    f.color === "primary"
                      ? "bg-primary/15 text-primary"
                      : f.color === "model-blue"
                      ? "bg-model-blue/15 text-model-blue"
                      : f.color === "model-green"
                      ? "bg-model-green/15 text-model-green"
                      : "bg-model-orange/15 text-model-orange"
                  }`}
                >
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA - Floating Island */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-model-blue/5 p-10 sm:p-14 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to unlock the full power?</h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-8">
                Start free with 5 requests. Upgrade to Pro for unlimited access to all models, priority support, and more.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" onClick={() => navigate("/auth")} className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/25">
                  Start Free Today <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate("/pricing")} className="text-base px-8 py-6 rounded-xl">
                  See Plans
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <span className="font-semibold text-sm">OptiNeural</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 OptiNeural. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
