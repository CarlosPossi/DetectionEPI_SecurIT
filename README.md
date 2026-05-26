# SecurIT - Terminal de Detecção (Visão Computacional) 🎥

O **DetectionEPI** é o módulo de terminal (totem) do ecossistema SecurIT. Ele é responsável por realizar a autenticação do operador e aplicar Inteligência Artificial (Visão Computacional via YOLO) para garantir o uso correto de Equipamentos de Proteção Individual (EPIs).

## 🚀 Funcionalidades Principais

* **Autenticação Facial:** Identificação biométrica do funcionário no início do turno (atualmente consumindo a lista de funcionários do banco de dados principal).
* **Configuração de Turno:** O funcionário seleciona quais EPIs são obrigatórios para a sua tarefa e indica em qual setor/localização irá atuar.
* **Visão Computacional em Tempo Real:** Captura o feed da webcam e processa os frames usando um modelo YOLO para identificar capacetes, coletes, luvas, óculos e botas.
* **Alertas Inteligentes e Snapshots:** Calcula a média de conformidade durante o monitoramento. Se o uso do EPI cair abaixo de 50% ou se o funcionário entrar em uma área de alto risco, o sistema tira um *print screen* da infração.
* **Integração Ponta-a-Ponta:** Comunica-se diretamente via API REST com o **SPI_Challenge** para enviar check-ins imediatos, atualizações de status e as fotos das infrações.

## 🛠️ Tecnologias Utilizadas

* **Frontend:** React (com Vite e TanStack Router), Tailwind CSS.
* **Visão Computacional:** Ultralytics YOLOv8 (Backend Python/Flask acoplado).
* **Comunicação em Tempo Real:** WebSockets (Socket.io) para comunicação entre a câmera do frontend e o motor YOLO no backend.
* **Câmera:** `react-webcam`.

## ⚙️ Como Executar o Projeto

Este projeto é dividido em duas partes que devem rodar simultaneamente:

### 1. Iniciar o Motor de Detecção (Backend Python)
Abra um terminal na pasta do projeto e inicie a API de inferência do YOLO:
```bash
cd backend
# Crie e ative um ambiente virtual (recomendado)
python -m venv venv
source venv/bin/activate # ou venv\Scripts\activate no Windows
pip install -r requirements.txt
python app.py
```
*O motor Socket.io rodará na porta 5001.*

### 2. Iniciar a Interface do Terminal (Frontend React)
Abra outro terminal na pasta do projeto:
```bash
cd frontend
npm install
npm run dev
```
*O terminal rodará em `http://localhost:5173`.*

## 🔌 Requisito de Integração
Para que o sistema de seleção de funcionários e o envio de alertas funcionem, o projeto **SPI_Challenge** (Dashboard) deve estar rodando simultaneamente na porta `3000` (URL configurada para os POST requests).
