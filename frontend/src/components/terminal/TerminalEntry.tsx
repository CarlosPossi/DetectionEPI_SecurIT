import { LogIn, UserPlus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TerminalEntryProps {
  onLogin: () => void;
  onRegister: () => void;
}

export function TerminalEntry({ onLogin, onRegister }: TerminalEntryProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-12 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-4">
        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-black tracking-tight">Bem-vindo ao Secur<span className="text-primary">IT</span></h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Selecione uma opção para iniciar seu monitoramento de segurança e conformidade.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <button
          onClick={onLogin}
          className="group relative flex flex-col items-center gap-6 p-10 rounded-3xl border-2 border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-xl"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
            <LogIn className="w-10 h-10" />
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">Entrar</h3>
            <p className="text-sm text-muted-foreground">Autenticação por reconhecimento facial para usuários já cadastrados.</p>
          </div>
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
          </div>
        </button>

        <button
          onClick={onRegister}
          className="group relative flex flex-col items-center gap-6 p-10 rounded-3xl border-2 border-border bg-card hover:border-secondary/50 hover:bg-secondary/5 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-xl"
        >
          <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-colors">
            <UserPlus className="w-10 h-10" />
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">Cadastrar</h3>
            <p className="text-sm text-muted-foreground">Primeiro acesso? Registre sua face e vincule ao seu perfil de colaborador.</p>
          </div>
        </button>
      </div>

      <div className="text-xs text-muted-foreground pt-8 uppercase tracking-widest font-semibold">
        Segurança Industrial Inteligente
      </div>
    </div>
  );
}
