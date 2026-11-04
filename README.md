# 🗄️ Gaveta Inteligente

> Assistente financeiro **Offline-First PWA** para gerenciar garantias, notas fiscais e assinaturas recorrentes com extração inteligente via **Google Gemini AI**.

---

## 🚀 Tecnologias

- **Front-end**: Vite, JavaScript Vanilla, Bootstrap 5 (Mobile-First Thumb Zone), Bootstrap Icons, PWA (Service Workers + Web App Manifest).
- **Armazenamento Local**: IndexedDB (via biblioteca `idb`) para funcionamento 100% offline ("Zero Atrito").
- **Back-end**: Node.js, Express.js.
- **Banco de Dados (Servidor)**: SQLite (`sql.js` WebAssembly) com sincronização em lote.
- **Inteligência Artificial**: SDK oficial `@google/genai` (Modelo `gemini-2.5-flash`) com **Structured Outputs (JSON Schema)** para OCR de fotos e PDFs.
- **Deploy**: Pré-configurado para o [Render](https://render.com) via `render.yaml` e monorepo unificado.

---

## 📁 Estrutura do Projeto

```text
GerenciadorNotas/
├── client/                      # Front-end PWA (Vite)
│   ├── public/
│   │   ├── icons/               # Ícones do PWA (SVG escaláveis)
│   │   ├── manifest.json        # Manifesto PWA para instalação no celular
│   │   └── sw.js                # Service Worker (Cache-First + Network-First)
│   ├── src/
│   │   ├── js/
│   │   │   ├── alerts.js        # Cálculo de vencimentos e radar de urgência
│   │   │   ├── api.js           # Comunicação com o Express e Gemini
│   │   │   ├── db.js            # Camada IndexedDB com idb
│   │   │   └── ui.js            # Renderização de cards, badges e modais
│   │   └── styles/
│   │       └── main.css         # Bottom Sheet modal e FAB ergonômico
│   ├── index.html
│   ├── main.js
│   ├── package.json
│   └── vite.config.js
├── server/                      # Back-end API (Express)
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js      # Conexão e sincronização SQLite
│   │   │   └── gemini.js        # SDK @google/genai com Schema estrito
│   │   ├── controllers/
│   │   │   └── documentController.js
│   │   ├── routes/
│   │   │   └── documentRoutes.js
│   │   └── server.js            # Servidor Express e fallback de SPA
│   ├── .env.example
│   └── package.json
├── render.yaml                  # Blueprint de deploy no Render
├── package.json                 # Scripts unificados de desenvolvimento e build
└── README.md
```

---

## 🛠️ Como Executar Localmente

### 1. Instalação das dependências
Na raiz do projeto:
```bash
npm run install:all
```

### 2. Configurar a chave do Gemini
Copie o arquivo de exemplo para `.env` dentro da pasta `server/`:
```bash
cp server/.env.example server/.env
```
Edite `server/.env` e adicione sua chave de API do [Google AI Studio](https://aistudio.google.com/):
```env
PORT=3001
GEMINI_API_KEY=AIzaSy...sua_chave_aqui...
NODE_ENV=development
```

### 3. Iniciar o projeto
Na raiz do projeto:
```bash
npm run dev
```
- **Front-end**: `http://localhost:5173`
- **Back-end API**: `http://localhost:3001`

---

## 🌐 Deploy no Render

1. Suba o repositório para o seu GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: Gaveta Inteligente PWA completa"
   git remote add origin https://github.com/SEU_USUARIO/gaveta-inteligente.git
   git push -u origin main
   ```
2. No painel do [Render](https://dashboard.render.com/):
   - Clique em **New +** -> **Blueprint**.
   - Conecte o repositório do GitHub. O Render detectará automaticamente o arquivo `render.yaml`.
   - Preencha a variável secreta `GEMINI_API_KEY`.
   - Clique em **Apply**. Seu app e API estarão no ar com HTTPS gratuito e suporte a instalação como PWA em qualquer smartphone.
