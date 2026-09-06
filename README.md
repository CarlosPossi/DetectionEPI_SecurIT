# SecurIT - Totem de Detecção e Inspeção de EPIs 🎥

O **DetectionEPI_SecurIT** é o terminal totem de chão de fábrica do ecossistema SecurIT. Ele é responsável por autenticar o operador via biometria facial, registrar o setor e a máquina de trabalho do turno, e aplicar Inteligência Artificial (Visão Computacional via YOLOv8 customizado) para auditoria contínua de Equipamentos de Proteção Individual (EPIs).

---

## 🚀 Funcionalidades Principais

* **Autenticação Biométrica Facial (DeepFace / VGG-Face):**
  * Reconhecimento instantâneo do operador via vetor facial (*embedding* de 4096 dimensões) comparado por distância cosseno ($< 0.4$).
  * Suporte a cadastro de novo rosto diretamente no totem (`FaceRegistration.tsx`) e fallback para seleção manual (`EmployeeSelection.tsx`).
* **Fluxo de Entrada em Dois Passos (Setor $\rightarrow$ Máquina):**
  1. **Seleção de Setor (`LocationRegistration.tsx`):** O colaborador escolhe em qual área irá atuar no turno (com indicação dos EPIs exigidos).
  2. **Seleção de Máquina (`MachineSelection.tsx`):** O totem lista dinamicamente as máquinas cadastradas naquele setor no MongoDB para vinculação operacional do operador.
* **Inspeção de EPIs em Tempo Real (YOLOv8 Customizado):**
  * Modelo neural próprio (`deteccaoepi.pt`) capaz de detectar: capacete, óculos de proteção, máscara, colete refletivo, luvas e calçados de segurança.
* **Manequim Ilustrado de Alerta Corporal (`EpiMannequinAlert.tsx`):**
  * Exibido na lateral do totem estritamente quando o operador permanece **mais de 10 segundos contínuos sem um EPI obrigatório**.
  * A anatomia correspondente ao EPI faltante pisca em vermelho vivo com efeito de brilho (*glow*) e animação pulsante.
  * O boneco **desaparece imediatamente** assim que o colaborador coloca o equipamento em conformidade.
* **Ciclos de Monitoramento e Gamificação:**
  * Avaliações contínuas de 1 minuto em barra de progresso.
  * Ciclos com conformidade **$\ge 80\%$** concedem **+10 XP** no banco compartilhado, incrementando sequências (*streak*).
  * Ciclos abaixo de $80\%$ zeram a sequência e não pontuam.
* **Integração de Hardware IoT (ESP32):**
  * Acionamento de sirene física sonora/luminosa na rede local caso a conformidade permaneça em nível crítico.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** React 18, Vite, TanStack Router, Tailwind CSS, Lucide Icons, Sonner.
* **Backend:** Python 3.12, Flask, Flask-SocketIO, PyMongo.
* **Visão Computacional & Biometria:** Ultralytics YOLOv8, OpenCV, DeepFace (VGG-Face).
* **Banco de Dados:** MongoDB compartilhado (`securit_db`).

---

## ⚙️ Como Executar o Projeto

### Método Rápido (Execução Simultânea)
Na raiz da pasta `/Users/fabio/Desktop/DetectionEPI_SecurIT`:
```bash
npm run dev
```
> O script inicia simultaneamente o frontend (Vite na porta **8080**) e o backend Python (Flask na porta **5001**) utilizando automaticamente o ambiente virtual `venv`.

---

### Execução em Terminais Separados

#### 1. Backend de Visão Computacional (Python / Flask)
```bash
cd backend
# Criar e ativar ambiente virtual (se for a primeira vez)
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Iniciar servidor Flask + Socket.IO
python app.py
```
*Servidor ativo em: `http://localhost:5001`*

#### 2. Interface do Totem (Frontend React)
```bash
cd frontend
npm install
npm run dev
```
*Totem ativo em: `http://localhost:8080`*

---

## 🗄️ Estrutura do Banco de Dados Compartilhado

O totem conecta-se diretamente à base MongoDB (`securit_db`), sincronizada com o **SPI_Challenge**:
* **`Employee`**: Leitura de perfil, biometria (`faceEncoding`), localização (`location`), máquina operada (`machine`), status (`online`/`offline`) e pontuação de XP.
* **`Sector` & `Machine`**: Consulta de setores industriais e suas respectivas máquinas vinculadas.
* **`Activity`**: Registro de check-ins de entrada no turno com o título `"EPI Verificado (Check-in) [Nome da Máquina]"` e relatórios de ciclos.
* **`Alert`**: Registro de infrações críticas com evidências em imagem Base64.
