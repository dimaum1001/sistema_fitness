from fastapi import APIRouter
from . import admin, auth, exercises, plans, executions, privacy, students, assessments

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(privacy.router, prefix="/privacidade", tags=["privacidade"])
api_router.include_router(exercises.router, prefix="/exercicios", tags=["exercicios"])
api_router.include_router(plans.router, prefix="/planos", tags=["planos"])
api_router.include_router(executions.router, prefix="/execucoes", tags=["execucoes"])
api_router.include_router(students.router, prefix="/alunos", tags=["alunos"])
api_router.include_router(assessments.router, prefix="/avaliacoes", tags=["avaliacoes"])
