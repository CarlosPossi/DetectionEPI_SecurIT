# 🎥 DetectionEPI_SecurIT - Documentação Arquitetural e Guia Completo do Agente

> **AVISO IMPORTANTE PARA AGENTES DE IA (Gemini / Antigravity)**:  
> Este documento é o **GUIA TÉCNICO E COMPLETO DO TERMINAL TOTEM**. Antes de modificar a comunicação Socket.IO, as rotas Flask, o processamento de imagens ou a integração com o SPI_Challenge, leia este arquivo para preservar a estabilidade da visão computacional e do banco de dados compartilhado.

---

## 📑 Sumário

1. [Papel no Ecossistema e Arquitetura](#1-papel-no-ecossistema-e-arquitetura)
2. [Estrutura de Pastas e Componentes](#2-estrutura-de-pastas-e-componentes)
3. [Motor de Visão Computacional (YOLOv8 & DeepFace)](#3-motor-de-visão-computacional-yolov8--deepface)
4. [Eventos Socket.IO e Comunicação em Tempo Real](#4-eventos-socketio-e-comunicação-em-tempo-real)
5. [Regras de Negócio e Gamificação de EPIs](#5-regras-de-negócio-e-gamificação-de-epis)
6. [Integração IoT Hardware (ESP32)](#6-integração-iot-hardware-esp32)
7. [Integração MongoDB Compartilhado](#7-integração-mongodb-compartilhado)

---

## 1. Papel no Ecossistema e Arquitetura

O **DetectionEPI_SecurIT** é o Totem de Entrada e Terminal de Inspeção Biométrica e de Equipamentos de Proteção Individual (EPIs). 

Ele conecta o operador na ponta (chão de fábrica) ao banco de dados compartilhado MongoDB (`securit_db`) e sincroniza dados em tempo real com o Dashboard central **SPI_Challenge**:

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                      DetectionEPI Frontend (React 18)                   │
 │ (Autenticação Facial -> Seleção de Setor -> Stream da Câmera -> Totem) │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │ WebSockets (Socket.IO) & REST
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                      DetectionEPI Backend (Flask 5001)                  │
 │ (DeepFace VGG-Face + YOLO custom deteccaoepi.pt + ESP32 Trigger)       │
 └──────────────────┬──────────────────────────────────────┬───────────────┘
                    │                                      │
                    │ PyMongo                              │ HTTP POST Forward
                    ▼                                      ▼
 ┌────────────────────────────────────┐  ┌─────────────────────────────────┐
 │   MongoDB Shared (securit_db)      │  │   SPI_Challenge Dashboard       │
 │   (Employee, Activity, Alert)      │  │   (Next.js App Router 3000)     │
 └────────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 2. Estrutura de Pastas e Componentes

### Backend (`/backend`)
* **`app.py`**: Aplicação principal Flask + Socket.IO. Contém endpoints REST, manipuladores de Socket.IO, conexão PyMongo e lógica de acionamento do ESP32.
* **`deteccaoepi.pt`**: Modelo PyTorch treinado sob medida no Ultralytics YOLOv8 (~120 MB) para detecção de capacetes, coletes, luvas, óculos, máscaras e botas.
* **`db_debug.py`**: Script utilitário para checagem rápida da conexão MongoDB.

### Frontend (`/frontend`)
* **`src/routes/index.tsx`**: Orquestrador principal do terminal (máquina de estados do totem). Gerencia o fluxo entre `entry`, `login`, `employee-select`, `face-registration`, `location` e `monitoring`.
* **`src/components/WebcamDetection.tsx`**: Componente da câmera webcam que realiza a captura de quadros e estabelece o Socket.IO com o servidor Python.
* **`src/components/terminal/`**:
  * **`FacialLogin.tsx`**: Interface de leitura e verificação biométrica.
  * **`FaceRegistration.tsx`**: Tela de cadastro de novos rostos.
  * **`EmployeeSelection.tsx`**: Seleção manual de funcionário.
  * **`LocationRegistration.tsx`**: Seleção de setor/localização de trabalho do turno.
  * **`TerminalEntry.tsx`**: Tela inicial de boas-vindas do totem.

---

## 3. Motor de Visão Computacional (YOLOv8 & DeepFace)

### A. Reconhecimento Biométrico Facial (DeepFace)
* **Modelo**: `VGG-Face` via biblioteca DeepFace.
* **Algoritmo de Distância**: Distância Cosseno.
* **Limiar de Tolerância (Threshold)**: `0.4`. Se a distância cosseno entre a captura e o embedding salvo em `Employee.faceEncoding` for $< 0.4$, o funcionário é autenticado.
* **Estimativa de Distância**: O sistema calcula a largura relativa da face no enquadramento. Se o rosto for $< 25\%$ da largura da câmera, o sistema orienta `"Aproxime-se"`. Se for $> 75\%$, orienta `"Afaste-se"`.

### B. Inferência de EPIs (YOLO Customizado)
* **Classes Detectadas**: `capacete`, `colete`, `luva`, `oculos`, `mascara`, `bota`.
* **Cálculo de Conformidade**:
  $$\text{Conformidade} = \frac{\text{Quantidade de EPIs detectados}}{\text{Quantidade de EPIs exigidos no setor}}$$

---

## 4. Eventos Socket.IO e Comunicação em Tempo Real

| Evento Socket.IO | Direção | Descrição |
| :--- | :--- | :--- |
| `identify_face` | Cliente -> Servidor | Envia quadro Base64 para verificação biométrica contra os embeddings cadastrados no banco. |
| `identification_result` | Servidor -> Cliente | Devolve o status (`success`, `no_face`, `unknown`, `error`) e o objeto do usuário identificado. |
| `register_face` | Cliente -> Servidor | Recebe foto e `employeeId` para gerar embedding VGG-Face e gravar em `Employee.faceEncoding`. |
| `registration_result` | Servidor -> Cliente | Retorna confirmação de cadastro do rosto. |
| `frame` | Cliente -> Servidor | Stream contínuo de vídeo durante a monitoria para inferência do modelo YOLO. |
| `detections` | Servidor -> Cliente | Retorna as caixas delimitadoras (`box`), rótulos (`label`) e confiança (`conf`). |
| `disconnect` | Ambas | Ao desconectar o WebSocket, o backend realiza o **logout automático**, alterando o status do operador para `offline` e a conformidade para `0%`. |

---

## 5. Regras de Negócio e Gamificação de EPIs

### 🎮 Regra 1: Check-in Inicial Sem Concessão de XP
* O evento de finalização da tela de localização envia o payload com `checkIn: time`.
* **Comportamento**: Registra o horário de início do turno, ajusta o status para `online`, mas **NÃO SOMA NENHUM XP** (`xpGained = 0`). A atividade é gravada com o título `"EPI Verificado (Check-in)"`.

### 🎯 Regra 2: Ciclos de 1 Minuto e Ganho de XP
* Durante o passo de `monitoring`, o frontend acumula amostras segundo a segundo em `history`.
* Ao atingir 100% da barra (60 segundos):
  * Se a média ponderada do ciclo for **≥ 80%**: Notifica o backend e exibe o toast de comemoração no totem (`🎉 +10 XP conquistados!`). O saldo de XP no MongoDB é incrementado em **estritamente +10 XP**.
  * Se a média for **< 80%**: Exibe toast informativo (`⚠️ Ciclo encerrado com X% de conformidade. Mantenha ≥ 80% para ganhar +10 XP!`), reseta a sequência (`streak = 0`) e concede **0 XP**.

### 🔌 Regra 3: Status Offline = 0% de Conformidade
* Sempre que uma sessão for encerrada por logout manual ou desconexão do navegador, o backend atualiza o documento `Employee` no MongoDB setando **`status = 'offline'`** e **`compliance = 0`**.

### 🛑 Regra 4: Deduplicação Temporal de 10 Segundos
* O backend Flask inspeciona a coleção `Activity`. Se já existir uma gravação para aquele funcionário nos últimos **10 segundos**, o evento é considerado duplicado e ignorado.

---

## 6. Integração IoT Hardware (ESP32)

O backend Python comunica-se com um módulo microcontrolador ESP32 na rede local para acionamento de alarme sonoro/luminoso físico:

* **Endereço do Alarme**: `http://192.168.0.23/alert` (HTTP POST) -> Disparado se o uso de EPIs for violado por mais do tempo limite ou se o operador entrar em setor não autorizado.
* **Endereço de Parada**: `http://192.168.0.23/stop` (HTTP POST) -> Disparado quando a conformidade se normaliza.

---

## 7. Integração MongoDB Compartilhado

O backend conecta-se via `pymongo.MongoClient(os.getenv("DATABASE_URL"))` ao mesmo banco de dados do `SPI_Challenge`:

* **`Employee`**: Leitura de dados, gravação de `faceEncoding`, atualização de status (`online`/`offline`), localização, conformidade, `xp`, `level`, `streak`, `totalChecks` e `compliantChecks`.
* **`Activity`**: Inserção de históricos de check-in e ciclos de monitoramento.
* **`Alert`**: Inserção de infrações críticas com Base64 da imagem para exibição imediata no Dashboard central.
* **`Sector`**: Leitura de setores e seus EPIs obrigatórios configurados.
