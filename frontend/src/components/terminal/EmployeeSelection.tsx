import { useState, useEffect } from "react";
import { User, Loader2, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Employee {
  id: string;
  name: string;
  role: string;
  requiredEPIs?: string[];
}

interface EmployeeSelectionProps {
  onSelect: (employee: Employee) => void;
  unregisteredOnly?: boolean;
}

export function EmployeeSelection({ onSelect, unregisteredOnly = false }: EmployeeSelectionProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadEmployees() {
      try {
        const SPI_API_URL = import.meta.env.VITE_SPI_API_URL || "http://localhost:5001";
        const url = `${SPI_API_URL}/api/employees${unregisteredOnly ? "?unregistered=true" : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        setEmployees(data);
      } catch (e) {
        console.error("Erro ao carregar funcionários", e);
      } finally {
        setLoading(false);
      }
    }
    loadEmployees();
  }, [unregisteredOnly]);

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Selecione o Operador</h2>
        <p className="text-muted-foreground">Confirme sua identidade na lista de funcionários registrados</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionário..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((emp) => (
            <button
              key={emp.id}
              onClick={() => onSelect(emp)}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">{emp.name}</p>
                  <p className="text-xs text-muted-foreground">{emp.role}</p>
                </div>
              </div>
              <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
            </button>
          ))
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum funcionário encontrado.</p>
        )}
      </div>
    </div>
  );
}
