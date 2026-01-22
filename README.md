# Sistema Fitness Total

MVP com backend FastAPI + SQLAlchemy e frontend React + Vite + Tailwind.

## Tecnologias
- Backend: FastAPI, Uvicorn, SQLAlchemy 2, Pydantic 2 + pydantic-settings, python-jose (JWT), bcrypt.
- Banco: SQLite local por padrao (suporte a PostgreSQL via `DATABASE_URL`).
- Frontend: React 18, React Router, Vite, TailwindCSS.

## Backend — como rodar
1) Entrar na pasta e ativar o venv existente (ou criar um):
```
cd backend
.venv\Scripts\activate
```
2) Instalar dependencias (se necessario):
```
pip install -r requirements.txt
```
3) Variaveis de ambiente: copie `.env.example` para `.env` e ajuste se quiser banco diferente ou outra SECRET_KEY.
4) Criar o banco/tabelas (SQLite padrao):
```
.venv\Scripts\python - <<'PY'
from app.database import Base, engine
Base.metadata.create_all(bind=engine)
PY
```
5) (Opcional) Popular usuarios de teste:
```
.venv\Scripts\python seed_test_users.py
```
6) Subir a API:
```
.venv\Scripts\uvicorn app.main:app --reload
```
A API fica em http://127.0.0.1:8000 (docs em `/docs`).

## Logins de teste
O script `backend/seed_test_users.py` cria:
- Admin: `admin@test.com` / `senha123`
- Professor: `professor@test.com` / `senha123`
- Aluno vinculado: `aluno@test.com` / `senha123`

## LGPD (baseline)
- Consentimento: tela `Conta` exige aceite de termos/privacidade e dados sensiveis.
- Direitos: exportacao de dados e exclusao/anonimizacao de conta em `Conta`.
- Politicas: paginas `Termos de Uso` e `Politica de Privacidade` sao modelos e devem ser revisadas.

## Frontend — como rodar
1) Entrar na pasta:
```
cd frontend
```
2) Instalar dependencias:
```
npm install
```
3) Opcional: criar `.env` com `VITE_API_URL=http://localhost:8000` (default ja usa esse endereco).
4) Rodar:
```
npm run dev
```
O Vite sobe em http://localhost:5173. Faca login com os usuarios de teste acima; o token e salvo no localStorage e as rotas protegidas sao `/professor/...` e `/aluno/...`.

Principais telas do frontend:
- Admin: professores (cadastro/lista).
- Professor: dashboard, alunos (cadastro), exercicios (criar/listar/explicacao), planos/sessoes, relatorios simples por aluno.
- Aluno: dashboard (agenda, treino do dia, registrar execucao), historico de execucoes, biblioteca de exercicios.

## Estrutura
- backend/
  - app/ (main, database, models, schemas, routers, core)
  - seed_test_users.py
- frontend/
  - src/ (paginas React, cliente de API, contextos)
